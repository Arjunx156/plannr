import { beforeAll, describe, expect, test } from "bun:test";
import { bodyCap, createApp } from "../server/app";
import { createLocalDb } from "../server/db/local";
import type { Db } from "../server/db/types";
import { pruneLimits, rateLimiter, sharedLimiter } from "../server/limits";

let db: Db;
beforeAll(async () => {
  db = await createLocalDb();
});

describe("the limiter in memory", () => {
  test("allows a burst then blocks until the window resets", () => {
    const allow = rateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 1)).toBe(true);
    expect(allow("ip", 2)).toBe(false);
    expect(allow("other", 2)).toBe(true);
    expect(allow("ip", 1001)).toBe(true);
  });

  test("a flood of new addresses can't wipe an abuser's count, and finished windows are forgotten", () => {
    const allow = rateLimiter(1, 1000, 10);
    expect(allow("abuser", 0)).toBe(true);
    expect(allow("abuser", 1)).toBe(false);
    for (let i = 0; i < 50; i++) allow(`flood-${i}`, 2);
    expect(allow("abuser", 3)).toBe(false);
    // Once its window ends, the abuser starts afresh like anyone else.
    expect(allow("abuser", 1001)).toBe(true);
  });

  test("never holds more keys than its cap: a flood beyond it is refused", () => {
    const allow = rateLimiter(5, 1000, 3);
    expect([allow("a", 0), allow("b", 0), allow("c", 0)]).toEqual([true, true, true]);
    expect(allow("d", 1)).toBe(false);
    // Once the windows end there's room again.
    expect(allow("d", 1001)).toBe(true);
  });
});

describe("the limiter shared through the database", () => {
  test("two server instances count against the same limit", async () => {
    const first = sharedLimiter(db, 3, 60000);
    const second = sharedLimiter(db, 3, 60000);
    const key = `ai:${crypto.randomUUID()}`;
    expect(await first(key, 1000)).toBe(true);
    expect(await second(key, 1001)).toBe(true);
    expect(await first(key, 1002)).toBe(true);
    // Each instance has seen at most two requests, but together they've seen four.
    expect(await second(key, 1003)).toBe(false);
  });

  test("a new window starts the count again", async () => {
    const allow = sharedLimiter(db, 1, 60000);
    const key = `p:${crypto.randomUUID()}`;
    expect(await allow(key, 0)).toBe(true);
    expect(await sharedLimiter(db, 1, 60000)(key, 10)).toBe(false);
    expect(await sharedLimiter(db, 1, 60000)(key, 60001)).toBe(true);
  });

  test("the daily job prunes counters a day past their window", async () => {
    const key = `m:${crypto.randomUUID()}`;
    await sharedLimiter(db, 1, 60000)(key, 0);
    await pruneLimits(db, 86_400_001);
    // Pruned, so a fresh instance starts this key from one.
    expect(await sharedLimiter(db, 1, 60000)(key, 86_400_002)).toBe(true);
  });
});

describe("request bodies", () => {
  test("each kind of route has its own cap", () => {
    expect(bodyCap("/api/ai/read")).toBeGreaterThan(bodyCap("/api/ai/plan"));
    expect(bodyCap("/api/events/x/photo")).toBe(4_000_000);
    expect(bodyCap("/api/events/x/actions")).toBeLessThan(bodyCap("/api/events/x/photo"));
  });

  test("a body without a Content-Length is still cut off at the cap", async () => {
    const app = createApp({ db, env: {} });
    const big = new TextEncoder().encode(`{"text":"${"x".repeat(200_000)}"}`);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(big);
        c.close();
      },
    });
    const res = await app.request("/api/ai/intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      // @ts-expect-error: Bun's fetch needs this to send a stream; the DOM types don't know it
      duplex: "half",
    });
    expect(res.status).toBe(413);
  });
});
