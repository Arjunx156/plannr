import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { CommentView } from "../src/shared/types";
import { user } from "./db/authSchema";
import { comments } from "./db/schema";
import type { Db } from "./db/types";

import { HttpError, requireRole } from "./plans";

/** Comments on a plan's records: any member can read and write them. */

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
