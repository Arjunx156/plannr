import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { InvitePreview, Member, Role } from "../src/shared/types";
import { user } from "./db/authSchema";
import { changes, comments, events, invites, members } from "./db/schema";
import type { Db } from "./db/types";

import { HttpError, RANK, requireRole, roleOf } from "./plans";

/**
 * Who works on a plan: its members and their roles, the invite links that bring people in,
 * and moving a guest's plans to their real account when they sign in properly.
 */

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
