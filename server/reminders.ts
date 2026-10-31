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

/** A morning reminder older than this isn't worth delivering. */
const PUSH_TTL_SECONDS = 12 * 3600;

/** Web push through VAPID, or undefined when the keys aren't configured. */
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
        {
          TTL: PUSH_TTL_SECONDS,
          vapidDetails: { subject, publicKey: pub, privateKey: priv },
          urgency: "normal",
        },
      );
      return true;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return false;
      throw e;
    }
  };
}

/** Every plan a person is a member of. */
async function plansOf(db: Db, userId: string): Promise<PlannrEvent[]> {
  const rows = await db
    .select({ data: events.data })
    .from(members)
    .innerJoin(events, eq(events.id, members.eventId))
    .where(eq(members.userId, userId));
  return rows.map((r) => r.data);
}

type Subscription = typeof pushSubs.$inferSelect;
type Delivery = "sent" | "gone" | "failed";

/** Pushes one message to one device: sent, gone (the browser unsubscribed), or failed this time. */
async function deliver(send: PushSender, sub: Subscription, message: PushMessage): Promise<Delivery> {
  try {
    return (await send(sub, message)) ? "sent" : "gone";
  } catch (e) {
    console.error("[push] send failed:", e instanceof Error ? e.message : e);
    return "failed";
  }
}

/** Groups subscriptions by the person they belong to. */
function byPerson(subs: Subscription[]): Map<string, Subscription[]> {
  const out = new Map<string, Subscription[]>();
  for (const s of subs) out.set(s.userId, [...(out.get(s.userId) ?? []), s]);
  return out;
}

/** Today's reminders for everyone who asked for them. Devices that unsubscribed are forgotten. */
export async function sendReminders(
  db: Db,
  send: PushSender,
  today: string,
): Promise<{ people: number; sent: number; removed: number }> {
  const people = byPerson(await db.select().from(pushSubs));
  let sent = 0;
  const gone: string[] = [];
  for (const [userId, devices] of people) {
    const msg = morningMessage(await plansOf(db, userId), today);
    if (!msg) continue;
    for (const device of devices) {
      const result = await deliver(send, device, { ...msg, tag: `morning-${today}` });
      if (result === "sent") sent += 1;
      if (result === "gone") gone.push(device.endpoint);
    }
  }
  if (gone.length > 0) await db.delete(pushSubs).where(inArray(pushSubs.endpoint, gone));
  if (sent)
    await db
      .update(pushSubs)
      .set({ lastSentAt: new Date() })
      .where(inArray(pushSubs.userId, [...people.keys()]));
  return { people: people.size, sent, removed: gone.length };
}
