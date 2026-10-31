import { randomUUID } from "node:crypto";
import { and, like, lt, sql } from "drizzle-orm";
import { rateLimit } from "./db/authSchema";
import type { Db } from "./db/types";

/**
 * Burst limits for AI, shared links, uploads and beacons. A limiter in memory turns a flood away
 * before it costs a database write; behind it, counters in the database hold every server
 * instance to the same limit, since serverless instances come and go and each starts at zero.
 */

/** Keys a limiter tracks in memory. A flood beyond this is refused rather than allowed to grow it. */
const MAX_TRACKED_KEYS = 5000;
/** Plannr's own rows in Better Auth's rate_limit table start with this, so the two never collide. */
const KEY_PREFIX = "plannr:";

/** A fixed-window limiter in this instance's memory, with a hard cap on how many keys it holds. */
export function rateLimiter(limit = 40, windowMs = 60000, maxKeys = MAX_TRACKED_KEYS) {
  const hits = new Map<string, { count: number; reset: number }>();
  /** Forgets finished windows only, so a flood of new addresses can't wipe an abuser's count. */
  const sweep = (now: number) => {
    for (const [key, h] of hits) if (h.reset <= now) hits.delete(key);
  };
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      if (!h && hits.size >= maxKeys) sweep(now);
      // Still full of live windows: this is a flood, and memory stays bounded by refusing it.
      if (!h && hits.size >= maxKeys) return false;
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}

/** Counts one request against `key` in the database and returns the count in the current window. */
async function countHit(db: Db, key: string, windowMs: number, now: number): Promise<number> {
  const expired = sql`${rateLimit.lastRequest} <= ${now - windowMs}`;
  const [row] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key: KEY_PREFIX + key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      // lastRequest holds when this window started; an ended window starts again at one.
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimit.count} + 1 END`,
        lastRequest: sql`CASE WHEN ${expired} THEN ${now} ELSE ${rateLimit.lastRequest} END`,
      },
    })
    .returning({ count: rateLimit.count });
  return row?.count ?? 1;
}

/**
 * The limiter every route uses: memory first, then the database. If the database can't be
 * reached the memory limit still stands, so a hiccup never locks families out.
 */
export function sharedLimiter(db: Db, limit = 60, windowMs = 60000) {
  const local = rateLimiter(limit, windowMs);
  return async (key: string, now = Date.now()): Promise<boolean> => {
    if (!local(key, now)) return false;
    try {
      return (await countHit(db, key, windowMs, now)) <= limit;
    } catch (e) {
      console.error("[limits] shared counter failed:", e instanceof Error ? e.message : e);
      return true;
    }
  };
}

/** Removes Plannr's counters whose window ended more than a day ago; run by the daily job. */
export async function pruneLimits(db: Db, now = Date.now()): Promise<void> {
  await db
    .delete(rateLimit)
    .where(and(like(rateLimit.key, `${KEY_PREFIX}%`), lt(rateLimit.lastRequest, now - 86_400_000)));
}
