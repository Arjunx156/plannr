import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { PlannrEvent } from "../src/data/types";
import { describeAction } from "../src/shared/describeAction";
import { applyEventAction, type EventAction, QUIET_ACTIONS, stamp } from "../src/shared/engine";
import type { PlanSummary, Role } from "../src/shared/types";
import { count } from "./admin";
import { changes, events, members } from "./db/schema";
import type { Db } from "./db/types";

/**
 * Plans themselves: who may do what, the plan and its versions, changes and their history.
 * Members and invites live in members.ts, comments in comments.ts. Every write checks the
 * caller's role first.
 */

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** How much each role may do; a higher rank includes everything below it. */
export const RANK: Record<Role, number> = { viewer: 0, planner: 1, owner: 2 };
export const MAX_RETRIES = 5;

/** The caller's role on a plan, or undefined when they aren't a member. */
export async function roleOf(db: Db, eventId: string, userId: string): Promise<Role | undefined> {
  const [row] = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.eventId, eventId), eq(members.userId, userId)));
  return row?.role;
}

/** Refuses unless the caller holds at least `min` on the plan; a non-member sees "not found". */
export async function requireRole(db: Db, eventId: string, userId: string, min: Role): Promise<Role> {
  const role = await roleOf(db, eventId, userId);
  if (!role) throw new HttpError(404, "Event not found");
  if (RANK[role] < RANK[min])
    throw new HttpError(
      403,
      min === "owner" ? "Only the owner can do that" : "You can view this plan but not change it",
    );
  return role;
}

// ---------------------------------------------------------------- plans

export async function listPlans(db: Db, userId: string): Promise<PlanSummary[]> {
  const rows = await db
    .select({ event: events.data, version: events.version, role: members.role, side: members.side })
    .from(members)
    .innerJoin(events, eq(events.id, members.eventId))
    .where(eq(members.userId, userId))
    .orderBy(desc(events.updatedAt));
  return rows;
}

export async function getPlan(db: Db, eventId: string, userId: string): Promise<PlanSummary> {
  const [row] = await db
    .select({ event: events.data, version: events.version, role: members.role, side: members.side })
    .from(members)
    .innerJoin(events, eq(events.id, members.eventId))
    .where(and(eq(members.eventId, eventId), eq(members.userId, userId)));
  if (!row) throw new HttpError(404, "Event not found");
  return row;
}

export async function planVersion(db: Db, eventId: string, userId: string): Promise<number> {
  await requireRole(db, eventId, userId, "viewer");
  const [row] = await db.select({ version: events.version }).from(events).where(eq(events.id, eventId));
  return row?.version ?? 0;
}

export async function createPlan(db: Db, userId: string, event: PlannrEvent): Promise<PlanSummary> {
  const [existing] = await db.select({ id: events.id }).from(events).where(eq(events.id, event.id));
  if (existing) throw new HttpError(409, "An event with this id already exists");
  await db.insert(events).values({ id: event.id, ownerId: userId, data: event, base: event, version: 1 });
  await db.insert(members).values({ eventId: event.id, userId, role: "owner" });
  await count(db, "plan");
  return { event, version: 1, role: "owner", side: null };
}

/**
 * Saves the plan only if it is still at the version it was read at: the compare-and-swap at
 * the heart of optimistic locking. False means someone else wrote first and the caller retries.
 */
export async function writeIfUnchanged(
  db: Db,
  eventId: string,
  readAt: number,
  data: PlannrEvent,
  version: number,
): Promise<boolean> {
  const updated = await db
    .update(events)
    .set({ data, version, updatedAt: new Date() })
    .where(and(eq(events.id, eventId), eq(events.version, readAt)))
    .returning({ version: events.version });
  return updated.length > 0;
}

/**
 * Applies changes with optimistic locking: read, apply, and write only if nobody else
 * wrote in between; otherwise read again and re-apply on top of their change.
 */
export async function applyActions(
  db: Db,
  eventId: string,
  userId: string,
  incoming: EventAction[],
): Promise<{ event: PlannrEvent; version: number }> {
  const role = await requireRole(db, eventId, userId, "planner");
  if (incoming.some(decidesExpense)) await requireTreasurer(db, eventId, userId, role);
  return commit(db, eventId, { userId }, incoming);
}

/** Approving or declining a committee expense. */
function decidesExpense(a: EventAction): boolean {
  return (
    a.type === "approveExpense" ||
    (a.type === "updateRecord" && a.coll === "approvals" && "status" in a.patch)
  );
}

const isTreasurer = (side: string | null) => side?.trim().toLowerCase() === "treasurer";

/**
 * When the committee has named a treasurer, only the treasurer or the owner decides on
 * expenses, so no one approves their own claim. Without one, any planner can.
 */
async function requireTreasurer(db: Db, eventId: string, userId: string, role: Role): Promise<void> {
  if (role === "owner") return;
  const rows = await db
    .select({ userId: members.userId, side: members.side })
    .from(members)
    .where(eq(members.eventId, eventId));
  const treasurers = rows.filter((r) => isTreasurer(r.side));
  if (treasurers.length > 0 && !treasurers.some((r) => r.userId === userId))
    throw new HttpError(403, "Only the treasurer or the owner can approve expenses");
}

/** A plan bigger than this can't be saved; it would be slow to open on a phone. */
export const MAX_PLAN_BYTES = 1_500_000;

/**
 * Applies changes with optimistic locking: read, apply, and write only if nobody else
 * wrote in between; otherwise read again and re-apply on top of their change. Who made
 * the change is a member's user id, or a name for someone using a shared link.
 */
export async function commit(
  db: Db,
  eventId: string,
  who: { userId?: string; actor?: string },
  incoming: EventAction[],
  check?: (current: PlannrEvent, action: EventAction) => void,
): Promise<{ event: PlannrEvent; version: number }> {
  const actions = incoming.map((a) => stamp({ ...a, eventId } as EventAction));
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const [row] = await db
      .select({ data: events.data, version: events.version })
      .from(events)
      .where(eq(events.id, eventId));
    if (!row) throw new HttpError(404, "Event not found");
    let next = row.data;
    const summaries: string[] = [];
    for (const action of actions) {
      check?.(next, action);
      summaries.push(describeAction(action, next));
      next = applyEventAction(next, action);
    }
    if (JSON.stringify(next).length > MAX_PLAN_BYTES)
      throw new HttpError(413, "The plan is too large to save. Remove old photos or notes first.");
    const version = row.version + actions.length;
    if (!(await writeIfUnchanged(db, eventId, row.version, next, version))) continue;
    await db.insert(changes).values(
      actions.map((action, i) => ({
        id: `chg_${randomUUID()}`,
        eventId,
        seq: row.version + i + 1,
        userId: who.userId ?? null,
        actor: who.actor ?? null,
        kind: "action" as const,
        action,
        summary: summaries[i] ?? "",
        quiet: QUIET_ACTIONS.has(action.type),
      })),
    );
    return { event: next, version };
  }
  throw new HttpError(409, "The plan is changing quickly; try again");
}
