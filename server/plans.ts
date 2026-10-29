import { randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { PlannrEvent } from "../src/data/types";
import {
  applyEventAction,
  describeAction,
  type EventAction,
  QUIET_ACTIONS,
  replay,
  stamp,
} from "../src/shared/engine";
import type {
  ActivityEntry,
  CommentView,
  HistoryEntry,
  InvitePreview,
  Member,
  PlanSummary,
  Role,
} from "../src/shared/types";
import { count } from "./admin";
import { changes, comments, events, invites, members, user } from "./db/schema";
import type { Db } from "./db/types";

/**
 * Everything Plannr stores about plans: the plan itself, who works on it, its history
 * and the links that invite people in. Every write checks the caller's role first.
 */

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const RANK: Record<Role, number> = { viewer: 0, planner: 1, owner: 2 };
const MAX_RETRIES = 5;

export function canEdit(role: Role | undefined): boolean {
  return role === "owner" || role === "planner";
}

export async function roleOf(db: Db, eventId: string, userId: string): Promise<Role | undefined> {
  const [row] = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.eventId, eventId), eq(members.userId, userId)));
  return row?.role;
}

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
  if (treasurers.length && !treasurers.some((r) => r.userId === userId))
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
    const updated = await db
      .update(events)
      .set({ data: next, version, updatedAt: new Date() })
      .where(and(eq(events.id, eventId), eq(events.version, row.version)))
      .returning({ version: events.version });
    if (!updated.length) continue;
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

/** Rebuilds the plan from its starting point and every change that isn't undone. */
async function rebuild(
  db: Db,
  eventId: string,
  userId: string,
  record: { kind: "undo" | "redo"; targetId: string; summary: string },
): Promise<{ event: PlannrEvent; version: number }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const [row] = await db
      .select({ base: events.base, version: events.version })
      .from(events)
      .where(eq(events.id, eventId));
    if (!row) throw new HttpError(404, "Event not found");
    const active = await db
      .select({ action: changes.action })
      .from(changes)
      .where(and(eq(changes.eventId, eventId), eq(changes.kind, "action"), isNull(changes.undoneAt)))
      .orderBy(asc(changes.seq));
    const next = replay(
      row.base,
      active.flatMap((c) => (c.action ? [c.action] : [])),
    );
    const version = row.version + 1;
    const updated = await db
      .update(events)
      .set({ data: next, version, updatedAt: new Date() })
      .where(and(eq(events.id, eventId), eq(events.version, row.version)))
      .returning({ version: events.version });
    if (!updated.length) continue;
    await db.insert(changes).values({
      id: `chg_${randomUUID()}`,
      eventId,
      seq: version,
      userId,
      kind: record.kind,
      targetId: record.targetId,
      summary: record.summary,
    });
    return { event: next, version };
  }
  throw new HttpError(409, "The plan is changing quickly; try again");
}

export async function undoChange(
  db: Db,
  eventId: string,
  userId: string,
  changeId: string,
  redo = false,
): Promise<{ event: PlannrEvent; version: number }> {
  await requireRole(db, eventId, userId, "planner");
  const [target] = await db
    .select()
    .from(changes)
    .where(and(eq(changes.id, changeId), eq(changes.eventId, eventId)));
  if (target?.kind !== "action" || target.quiet) throw new HttpError(404, "Change not found");
  if (redo ? !target.undoneAt : target.undoneAt)
    throw new HttpError(409, redo ? "That change is already in the plan" : "That change is already undone");
  await db
    .update(changes)
    .set(redo ? { undoneAt: null, undoneBy: null } : { undoneAt: new Date(), undoneBy: userId })
    .where(eq(changes.id, changeId));
  return rebuild(db, eventId, userId, {
    kind: redo ? "redo" : "undo",
    targetId: changeId,
    summary: `${redo ? "Redid" : "Undid"}: ${target.summary}`,
  });
}

export async function history(db: Db, eventId: string, userId: string, limit = 100): Promise<HistoryEntry[]> {
  await requireRole(db, eventId, userId, "viewer");
  const rows = await db
    .select({
      id: changes.id,
      seq: changes.seq,
      kind: changes.kind,
      summary: changes.summary,
      createdAt: changes.createdAt,
      undoneAt: changes.undoneAt,
      targetId: changes.targetId,
      byId: changes.userId,
      by: user.name,
      actor: changes.actor,
    })
    .from(changes)
    .leftJoin(user, eq(user.id, changes.userId))
    .where(and(eq(changes.eventId, eventId), eq(changes.quiet, false)))
    .orderBy(desc(changes.seq))
    .limit(Math.min(500, Math.max(1, limit)));
  return rows.map((r) => ({
    id: r.id,
    seq: r.seq,
    kind: r.kind,
    summary: r.summary,
    at: r.createdAt.toISOString(),
    by: r.by ?? r.actor,
    byId: r.byId,
    undone: !!r.undoneAt,
    targetId: r.targetId,
  }));
}

/** The latest changes across every plan this person is part of, newest first. */
export async function activity(db: Db, userId: string, limit = 60): Promise<ActivityEntry[]> {
  const rows = await db
    .select({
      id: changes.id,
      eventId: changes.eventId,
      eventName: sql<string>`${events.data}->>'name'`,
      kind: changes.kind,
      summary: changes.summary,
      createdAt: changes.createdAt,
      byId: changes.userId,
      by: user.name,
      actor: changes.actor,
    })
    .from(changes)
    .innerJoin(members, and(eq(members.eventId, changes.eventId), eq(members.userId, userId)))
    .innerJoin(events, eq(events.id, changes.eventId))
    .leftJoin(user, eq(user.id, changes.userId))
    .where(eq(changes.quiet, false))
    .orderBy(desc(changes.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    eventName: r.eventName,
    kind: r.kind,
    summary: r.summary,
    at: r.createdAt.toISOString(),
    by: r.by ?? r.actor,
    mine: r.byId === userId,
  }));
}

// ---------------------------------------------------------------- people

export async function listMembers(db: Db, eventId: string, userId: string): Promise<Member[]> {
  await requireRole(db, eventId, userId, "viewer");
  const rows = await db
    .select({
      userId: members.userId,
      name: user.name,
      email: user.email,
      guest: user.isAnonymous,
      role: members.role,
      side: members.side,
    })
    .from(members)
    .innerJoin(user, eq(user.id, members.userId))
    .where(eq(members.eventId, eventId))
    .orderBy(asc(members.joinedAt));
  return rows.map((r) => ({ ...r, guest: !!r.guest, email: r.guest ? null : r.email }));
}

export async function updateMember(
  db: Db,
  eventId: string,
  userId: string,
  memberId: string,
  patch: { role?: Role; side?: string | null },
): Promise<void> {
  const myRole = await requireRole(db, eventId, userId, "planner");
  const target = await roleOf(db, eventId, memberId);
  if (!target) throw new HttpError(404, "Not a member of this event");
  if (patch.role && myRole !== "owner") throw new HttpError(403, "Only the owner can change roles");
  if (patch.role === "owner" || target === "owner")
    throw new HttpError(400, "The owner's role can't be changed here");
  await db
    .update(members)
    .set({
      ...(patch.role ? { role: patch.role } : {}),
      ...(patch.side !== undefined ? { side: patch.side } : {}),
    })
    .where(and(eq(members.eventId, eventId), eq(members.userId, memberId)));
}

export async function removeMember(db: Db, eventId: string, userId: string, memberId: string): Promise<void> {
  const myRole = await requireRole(db, eventId, userId, "viewer");
  const target = await roleOf(db, eventId, memberId);
  if (!target) throw new HttpError(404, "Not a member of this event");
  if (target === "owner") throw new HttpError(400, "The owner can't be removed");
  if (memberId !== userId && myRole !== "owner") throw new HttpError(403, "Only the owner can remove people");
  await db.delete(members).where(and(eq(members.eventId, eventId), eq(members.userId, memberId)));
}

// ---------------------------------------------------------------- invites

const INVITE_DAYS = 14;

export async function createInvite(
  db: Db,
  eventId: string,
  userId: string,
  opts: { role: Exclude<Role, "owner">; side?: string | null; maxUses?: number | null },
): Promise<{ token: string; expiresAt: string }> {
  const myRole = await requireRole(db, eventId, userId, "planner");
  if (opts.role === "planner" && myRole !== "owner" && myRole !== "planner")
    throw new HttpError(403, "You can't invite planners");
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86400000);
  await db.insert(invites).values({
    token,
    eventId,
    role: opts.role,
    side: opts.side ?? null,
    createdBy: userId,
    expiresAt,
    maxUses: opts.maxUses ?? null,
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

async function inviteRow(db: Db, token: string) {
  const [row] = await db
    .select({ invite: invites, event: events.data, inviter: user.name })
    .from(invites)
    .innerJoin(events, eq(events.id, invites.eventId))
    .innerJoin(user, eq(user.id, invites.createdBy))
    .where(eq(invites.token, token));
  return row;
}

function inviteProblem(invite: typeof invites.$inferSelect): string | undefined {
  if (invite.revokedAt) return "This invite was cancelled";
  if (invite.expiresAt.getTime() < Date.now()) return "This invite has expired";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return "This invite has been used";
  return undefined;
}

export async function previewInvite(db: Db, token: string): Promise<InvitePreview> {
  const row = await inviteRow(db, token);
  if (!row) throw new HttpError(404, "This invite link isn't valid");
  const reason = inviteProblem(row.invite);
  return {
    eventId: row.invite.eventId,
    eventName: row.event.name,
    kind: row.event.kind,
    date: row.event.date,
    role: row.invite.role,
    side: row.invite.side,
    invitedBy: row.inviter,
    valid: !reason,
    reason,
  };
}

export async function acceptInvite(
  db: Db,
  token: string,
  userId: string,
): Promise<{ eventId: string; role: Role }> {
  const row = await inviteRow(db, token);
  if (!row) throw new HttpError(404, "This invite link isn't valid");
  const reason = inviteProblem(row.invite);
  if (reason) throw new HttpError(410, reason);
  const { eventId, role, side } = row.invite;
  const current = await roleOf(db, eventId, userId);
  if (current && RANK[current] >= RANK[role]) return { eventId, role: current };
  if (current)
    await db
      .update(members)
      .set({ role })
      .where(and(eq(members.eventId, eventId), eq(members.userId, userId)));
  else await db.insert(members).values({ eventId, userId, role, side });
  await db
    .update(invites)
    .set({ uses: sql`${invites.uses} + 1` })
    .where(eq(invites.token, token));
  return { eventId, role };
}

// ---------------------------------------------------------------- comments

export async function listComments(
  db: Db,
  eventId: string,
  userId: string,
  recordType: string,
  recordId: string,
): Promise<CommentView[]> {
  await requireRole(db, eventId, userId, "viewer");
  const rows = await db
    .select({ id: comments.id, body: comments.body, by: user.name, at: comments.createdAt })
    .from(comments)
    .leftJoin(user, eq(user.id, comments.userId))
    .where(
      and(
        eq(comments.eventId, eventId),
        eq(comments.recordType, recordType),
        eq(comments.recordId, recordId),
      ),
    )
    .orderBy(asc(comments.createdAt));
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}

export async function addComment(
  db: Db,
  eventId: string,
  userId: string,
  input: { recordType: string; recordId: string; body: string },
): Promise<CommentView> {
  await requireRole(db, eventId, userId, "viewer");
  const id = `cmt_${randomUUID()}`;
  const body = input.body.trim().slice(0, 2000);
  if (!body) throw new HttpError(400, "Write something first");
  await db
    .insert(comments)
    .values({ id, eventId, userId, recordType: input.recordType, recordId: input.recordId, body });
  const [me] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  return { id, body, by: me?.name ?? null, at: new Date().toISOString() };
}

// ---------------------------------------------------------------- accounts

/** When a guest signs in properly, their plans move to the real account. */
export async function moveOwnership(db: Db, fromUserId: string, toUserId: string): Promise<void> {
  const mine = await db
    .select({ eventId: members.eventId })
    .from(members)
    .where(eq(members.userId, toUserId));
  const already = new Set(mine.map((m) => m.eventId));
  const theirs = await db.select().from(members).where(eq(members.userId, fromUserId));
  for (const m of theirs) {
    if (already.has(m.eventId)) continue;
    await db.insert(members).values({ ...m, userId: toUserId });
  }
  await db.update(events).set({ ownerId: toUserId }).where(eq(events.ownerId, fromUserId));
  await db.update(changes).set({ userId: toUserId }).where(eq(changes.userId, fromUserId));
  await db.update(comments).set({ userId: toUserId }).where(eq(comments.userId, fromUserId));
}
