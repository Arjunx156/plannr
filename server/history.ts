import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { PlannrEvent } from "../src/data/types";
import { replay } from "../src/shared/engine";
import type { ActivityEntry, HistoryEntry } from "../src/shared/types";
import { user } from "./db/authSchema";
import { changes, events, members } from "./db/schema";
import type { Db } from "./db/types";
import { HttpError, MAX_RETRIES, requireRole, writeIfUnchanged } from "./plans";

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
    if (!(await writeIfUnchanged(db, eventId, row.version, next, version))) continue;
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
