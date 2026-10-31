import { randomUUID } from "node:crypto";
import { desc, gte, sql } from "drizzle-orm";
import { DAY_MS } from "../src/lib/dates";
import { user } from "./db/authSchema";
import { aiUsage, errors, events, metrics } from "./db/schema";
import type { Db } from "./db/types";
import type { ServerEnv } from "./env";

/** Crash reports keep this much of the stack. */
const MAX_STACK_CHARS = 4000;
/** The admin page covers the last two weeks. */
const REPORT_DAYS = 14;

/**
 * What the owner of the site sees: daily counts (never who), recent errors to fix, and
 * how much AI is being used. Counts carry no names, addresses or cookies.
 */

export const METRIC_NAMES = ["visit", "plan", "rsvp", "link_open", "signin", "photo", "push_on"] as const;
/** The daily counts the admin page shows. */
export type MetricName = (typeof METRIC_NAMES)[number];

const today = () => new Date().toISOString().slice(0, 10);

/** Adds to today's count for one metric. Never throws: a count is not worth a failed request. */
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

/** Keeps a crash report for the admin page, trimmed to a safe size. */
export async function recordError(
  db: Db,
  e: {
    source: "client" | "server";
    message: string;
    stack?: string | undefined;
    url?: string | undefined;
    userAgent?: string | undefined;
    userId?: string;
  },
): Promise<void> {
  try {
    await db.insert(errors).values({
      id: `err_${randomUUID()}`,
      source: e.source,
      message: e.message.slice(0, 500),
      stack: e.stack?.slice(0, MAX_STACK_CHARS),
      url: e.url?.slice(0, 500),
      userAgent: e.userAgent?.slice(0, 300),
      userId: e.userId,
      release: process.env["VERCEL_GIT_COMMIT_SHA"]?.slice(0, 7),
    });
  } catch {
    // Nowhere left to report it.
  }
}

/** Whether an email is on the server's admin list. */
export function isAdmin(env: Pick<ServerEnv, "ADMIN_EMAILS">, email: string | undefined): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** The last two weeks of counts and AI use, and the latest crash reports, for the admin page. */
export async function adminSummary(db: Db) {
  const since = new Date(Date.now() - REPORT_DAYS * DAY_MS).toISOString().slice(0, 10);
  const days = await db.select().from(metrics).where(gte(metrics.day, since)).orderBy(desc(metrics.day));
  const ai = await db
    .select({
      day: aiUsage.day,
      calls: sql<number>`sum(${aiUsage.calls})`.mapWith(Number),
      tokens: sql<number>`sum(${aiUsage.tokens})`.mapWith(Number),
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
