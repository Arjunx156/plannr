import { and, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { handleAi, MAX_BODY, MAX_READ_BODY, ROUTE_COST, streamAssistant } from "../ai";
import { aiUsage } from "../db/schema";
import type { Db } from "../db/types";
import { type Api, clientIp, type RouteDeps } from "./kit";

/** AI calls a day: generous for planning, small enough that a runaway script costs little. */
export const DAILY_AI = { user: 300, visitor: 60 };

/** Adds what a call cost in tokens to today's row, for the cost view. */
export async function addTokens(db: Db, key: string, tokens: number): Promise<void> {
  if (!tokens) return;
  const day = new Date().toISOString().slice(0, 10);
  await db
    .update(aiUsage)
    .set({ tokens: sql`${aiUsage.tokens} + ${Math.round(tokens)}` })
    .where(and(eq(aiUsage.key, key), eq(aiUsage.day, day)))
    .catch(() => undefined);
}

/** Counts a call against today's allowance; false once it's used up. */
export async function spendAi(db: Db, key: string, cost: number, limit: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const [row] = await db
      .insert(aiUsage)
      .values({ key, day, calls: cost })
      .onConflictDoUpdate({
        target: [aiUsage.key, aiUsage.day],
        set: { calls: sql`${aiUsage.calls} + ${cost}` },
      })
      .returning({ calls: aiUsage.calls });
    return (row?.calls ?? 0) <= limit;
  } catch (e) {
    // Never block the family on the meter itself.
    console.error("[ai] usage meter failed:", e instanceof Error ? e.message : e);
    return true;
  }
}

/** /api/ai/*: Gemini behind a burst limit, a size cap and a daily allowance per person. */
export function aiRoutes(app: Api, { db, auth, ai, allow }: RouteDeps): void {
  app.get("/ai/status", async (c) => {
    const out = await handleAi("status", {}, ai());
    return c.json(out.body as object, {
      status: out.status as 200,
      headers: { "cache-control": "no-store" },
    });
  });

  /** The rate limit, size cap and daily allowance every AI call goes through. */
  const gate = async (c: Context, route: string): Promise<{ key: string } | Response> => {
    const ip = clientIp(c);
    if (!allow(`ai:${ip}`)) return c.json({ error: "Too many requests" }, 429);
    if (Number(c.req.header("content-length") ?? 0) > (route === "read" ? MAX_READ_BODY : MAX_BODY))
      return c.json({ error: "Request too large" }, 413);
    // A daily allowance per person (or per network for the demo), so one user can't run up the bill.
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    const key = session?.user.id ? `u:${session.user.id}` : `ip:${ip}`;
    const left = await spendAi(db, key, ROUTE_COST[route] ?? 1, session ? DAILY_AI.user : DAILY_AI.visitor);
    if (!left)
      return c.json(
        {
          error: "That's Plannr's AI limit for today. Everything else keeps working, and it resets tomorrow.",
        },
        429,
      );
    return { key };
  };

  // The assistant's answer as it's written, word by word, as server-sent events.
  app.post("/ai/assistant/stream", async (c) => {
    const allowed = await gate(c, "assistant");
    if (allowed instanceof Response) return allowed;
    const config = ai();
    if (!config.apiKey) return c.json({ error: "AI is not configured on this server" }, 503);
    const input = await c.req.json().catch(() => undefined);
    const meter = { tokens: 0 };
    return streamSSE(c, async (stream) => {
      const out = await streamAssistant(
        input,
        (text) => void stream.writeSSE({ event: "text", data: JSON.stringify({ text }) }),
        config,
        fetch,
        meter,
      );
      await stream.writeSSE({
        event: out.status === 200 ? "done" : "error",
        data: JSON.stringify(out.body),
      });
      await addTokens(db, allowed.key, meter.tokens);
    });
  });

  app.post("/ai/:route", async (c) => {
    const route = c.req.param("route");
    // Unknown routes are turned away before they count against anyone's allowance.
    if (!Object.hasOwn(ROUTE_COST, route)) return c.json({ error: "Unknown AI route" }, 404);
    const allowed = await gate(c, route);
    if (allowed instanceof Response) return allowed;
    const input = await c.req.json().catch(() => undefined);
    const meter = { tokens: 0 };
    const out = await handleAi(route, input, ai(), fetch, meter);
    await addTokens(db, allowed.key, meter.tokens);
    return c.json(out.body as object, out.status as 200);
  });
}
