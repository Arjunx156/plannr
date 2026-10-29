import { randomUUID } from "node:crypto";
import { desc, gte, sql } from "drizzle-orm";
import { aiUsage, errors, events, metrics, user } from "./db/schema";
import type { Db } from "./db/types";

/**
 * What the owner of the site sees: daily counts (never who), recent errors to fix, and
 * how much AI is being used. Counts carry no names, addresses or cookies.
 */

export const METRIC_NAMES = ["visit", "plan", "rsvp", "link_open", "signin", "photo", "push_on"] as const;
export type MetricName = (typeof METRIC_NAMES)[number];

const today = () => new Date().toISOString().slice(0, 10);

export async function count(db: Db, name: MetricName, by = 1): Promise<void> {
  try {
    await db
      .insert(metrics)
      .values({ day: today(), name, count: by })
      .onConflictDoUpdate({
        target: [metrics.day, metrics.name],
        set: { count: sql`${metrics.count} + ${by}` },
      });
  } catch {
    // Counting must never break the thing being counted.
  }
}

export async function recordError(
  db: Db,
  e: {
    source: "client" | "server";
    message: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    userId?: string;
  },
): Promise<void> {
  try {
    await db.insert(errors).values({
      id: `err_${randomUUID()}`,
      source: e.source,
      message: e.message.slice(0, 500),
      stack: e.stack?.slice(0, 4000),
      url: e.url?.slice(0, 500),
      userAgent: e.userAgent?.slice(0, 300),
      userId: e.userId,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
    });
  } catch {
    // Nowhere left to report it.
  }
}

export function isAdmin(env: Record<string, string | undefined>, email: string | undefined): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function adminSummary(db: Db) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const days = await db.select().from(metrics).where(gte(metrics.day, since)).orderBy(desc(metrics.day));
  const ai = await db
    .select({
      day: aiUsage.day,
      calls: sql<number>`sum(${aiUsage.calls})`.mapWith(Number),
      people: sql<number>`count(*)`.mapWith(Number),
    })
    .from(aiUsage)
    .where(gte(aiUsage.day, since))
    .groupBy(aiUsage.day)
    .orderBy(desc(aiUsage.day));
  const recent = await db
    .select({
      id: errors.id,
      at: errors.at,
      source: errors.source,
      message: errors.message,
      url: errors.url,
      release: errors.release,
    })
    .from(errors)
    .orderBy(desc(errors.at))
    .limit(50);
  const [totals] = await db
    .select({
      accounts: sql<number>`(select count(*) from ${user})`.mapWith(Number),
      plans: sql<number>`(select count(*) from ${events})`.mapWith(Number),
    })
    .from(sql`(select 1) as one`);
  return { days, ai, errors: recent, totals };
}

/** Keeps the errors table small: errors older than 30 days are of no more use. */
export async function pruneErrors(db: Db): Promise<void> {
  await db.delete(errors).where(sql`${errors.at} < now() - interval '30 days'`);
}
