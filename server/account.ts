import { and, asc, eq, ne } from "drizzle-orm";
import { user } from "./db/authSchema";
import { comments, events, members, templates } from "./db/schema";
import type { Db } from "./db/types";

/**
 * A person's own data, to take away or to erase (India's DPDP Act gives both rights).
 * Deleting an account never deletes a plan that other people still share: the longest-
 * standing co-planner becomes its owner. A plan only they had goes with them.
 */

export async function exportAccount(db: Db, userId: string) {
  const [me] = await db
    .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId));
  const plans = await db
    .select({ role: members.role, side: members.side, joinedAt: members.joinedAt, event: events.data })
    .from(members)
    .innerJoin(events, eq(events.id, members.eventId))
    .where(eq(members.userId, userId));
  const saved = await db
    .select({ id: templates.id, name: templates.name, createdAt: templates.createdAt, data: templates.data })
    .from(templates)
    .where(eq(templates.ownerId, userId));
  const said = await db
    .select({ eventId: comments.eventId, text: comments.body, at: comments.createdAt })
    .from(comments)
    .where(eq(comments.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    account: me ? { ...me, email: me.email.endsWith("@guest.plannr") ? null : me.email } : null,
    plans,
    templates: saved,
    comments: said,
  };
}

export async function deleteAccount(
  db: Db,
  userId: string,
): Promise<{ handedOver: number; deleted: number }> {
  const owned = await db.select({ id: events.id }).from(events).where(eq(events.ownerId, userId));
  let handedOver = 0;
  for (const { id } of owned) {
    const [next] = await db
      .select({ userId: members.userId, role: members.role })
      .from(members)
      .where(and(eq(members.eventId, id), ne(members.userId, userId)))
      .orderBy(asc(members.joinedAt));
    if (!next) continue;
    // Prefer a planner over a viewer to look after the plan.
    const [planner] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.eventId, id), ne(members.userId, userId), eq(members.role, "planner")))
      .orderBy(asc(members.joinedAt));
    const heir = planner?.userId ?? next.userId;
    await db.update(events).set({ ownerId: heir }).where(eq(events.id, id));
    await db
      .update(members)
      .set({ role: "owner" })
      .where(and(eq(members.eventId, id), eq(members.userId, heir)));
    handedOver += 1;
  }
  // Sessions, sign-in methods, memberships, templates and reminders go with the account;
  // plans nobody else shares go too. History keeps what happened, without the name.
  await db.delete(user).where(eq(user.id, userId));
  return { handedOver, deleted: owned.length - handedOver };
}
