import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import type { PlannrEvent } from "../src/data/types";
import { morningMessage } from "../src/shared/reminders";
import { events, members, pushSubs } from "./db/schema";
import type { Db } from "./db/types";

/**
 * Morning reminders by web push. A daily job asks each subscribed person's plans what's
 * due, and sends one short notification. Subscriptions the browser has dropped are removed.
 */

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Sends one push; resolves false when the subscription is gone for good. */
export type PushSender = (
  sub: { endpoint: string; p256dh: string; auth: string },
  msg: PushMessage,
) => Promise<boolean>;

export function webPushSender(env: Record<string, string | undefined>): PushSender | undefined {
  const pub = env.VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return undefined;
  const subject = env.BETTER_AUTH_URL?.startsWith("https://")
    ? env.BETTER_AUTH_URL
    : "mailto:reminders@plannr.app";
  return async (sub, msg) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(msg),
        { TTL: 12 * 3600, vapidDetails: { subject, publicKey: pub, privateKey: priv }, urgency: "normal" },
      );
      return true;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return false;
      throw e;
    }
  };
}

async function plansOf(db: Db, userId: string): Promise<PlannrEvent[]> {
  const rows = await db
    .select({ data: events.data })
    .from(members)
    .innerJoin(events, eq(events.id, members.eventId))
    .where(eq(members.userId, userId));
  return rows.map((r) => r.data);
}

/** Today's reminders for everyone who asked for them. */
export async function sendReminders(
  db: Db,
  send: PushSender,
  today: string,
): Promise<{ people: number; sent: number; removed: number }> {
  const subs = await db.select().from(pushSubs);
  const byUser = new Map<string, typeof subs>();
  for (const s of subs) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  let sent = 0;
  const gone: string[] = [];
  for (const [userId, list] of byUser) {
    const msg = morningMessage(await plansOf(db, userId), today);
    if (!msg) continue;
    for (const s of list) {
      try {
        if (await send(s, { ...msg, tag: `morning-${today}` })) sent += 1;
        else gone.push(s.endpoint);
      } catch (e) {
        console.error("[push] send failed:", e instanceof Error ? e.message : e);
      }
    }
  }
  if (gone.length) await db.delete(pushSubs).where(inArray(pushSubs.endpoint, gone));
  if (sent)
    await db
      .update(pushSubs)
      .set({ lastSentAt: new Date() })
      .where(inArray(pushSubs.userId, [...byUser.keys()]));
  return { people: byUser.size, sent, removed: gone.length };
}
