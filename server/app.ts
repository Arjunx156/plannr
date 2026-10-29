import { and, eq, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { PlannrEvent } from "../src/data/types";
import { EVENT_ACTION_TYPES, type EventAction } from "../src/shared/engine";
import { deleteAccount, exportAccount } from "./account";
import { adminSummary, count, isAdmin, METRIC_NAMES, pruneErrors, recordError } from "./admin";
import {
  type AiConfig,
  aiConfig,
  handleAi,
  MAX_BODY,
  MAX_READ_BODY,
  ROUTE_COST,
  rateLimiter,
  streamAssistant,
} from "./ai";
import {
  type Auth,
  type AuthEnv,
  createAuth,
  devOutbox,
  isProduction,
  mailFailure,
  signInMethods,
  trustedOrigins,
} from "./auth";
import { nightlyBackup } from "./backup";
import { aiUsage, pushSubs } from "./db/schema";
import type { Db } from "./db/types";
import {
  albumEvent,
  isLinkKind,
  linkFor,
  listLinks,
  publicActions,
  publicView,
  renameSite,
  revokeLink,
} from "./links";
import { blobStore, readPhoto, type StorePhoto } from "./photos";
import {
  acceptInvite,
  activity,
  addComment,
  applyActions,
  createInvite,
  createPlan,
  getPlan,
  HttpError,
  history,
  listComments,
  listMembers,
  listPlans,
  planVersion,
  previewInvite,
  removeMember,
  requireRole,
  undoChange,
  updateMember,
} from "./plans";
import { type PushSender, sendReminders, webPushSender } from "./reminders";
import { deleteTemplate, listTemplates, planFromTemplate, saveTemplate } from "./templates";
import { parseAction } from "./validate";

/**
 * Plannr's API under /api. The same app runs in the Vite dev server, the journey tests,
 * the Bun server and the Vercel function; only the database connection differs.
 */

export type AppEnv = AuthEnv &
  Record<string, string | undefined> & {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    /** Development and tests only: lets the journey tests read the last email code. */
    PLANNR_DEV_OUTBOX?: string;
  };

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

interface Vars {
  Variables: { userId: string };
}

const MAX_EVENT_BYTES = 400 * 1024;

const eventShape = z
  .object({
    id: z.string().min(3).max(120),
    kind: z.enum(["wedding", "birthday", "community", "other"]),
    layout: z.enum(["personal", "community", "empty"]),
    name: z.string().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .passthrough();

const actionShape = z
  .object({
    type: z.string().refine((t) => EVENT_ACTION_TYPES.has(t as EventAction["type"]), "Unknown change"),
    // Only a new draft carries a whole plan; it gets the same checks as creating one.
    event: eventShape.optional(),
  })
  .passthrough()
  .refine((a) => a.type !== "replacePlan" || !!a.event, "A new draft needs its plan");

const roleShape = z.enum(["planner", "viewer"]);

async function body<T>(c: Context, shape: z.ZodType<T>): Promise<T> {
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > MAX_BODY * 4) throw new HttpError(413, "Request too large");
  const raw = await c.req.json().catch(() => {
    throw new HttpError(400, "Expected JSON");
  });
  const parsed = shape.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  return parsed.data;
}

export function createApp(deps: {
  db: Db;
  env: AppEnv;
  auth?: Auth;
  ai?: () => AiConfig;
  photos?: StorePhoto;
  push?: PushSender;
}) {
  const { db, env } = deps;
  const push = deps.push ?? webPushSender(env);
  const photos = deps.photos ?? blobStore(env.BLOB_READ_WRITE_TOKEN);
  const store = async (eventId: string, req: Request): Promise<string> => {
    if (!photos) throw new HttpError(503, "Photo uploads aren't switched on yet");
    const { bytes, type } = await readPhoto(req);
    return photos(eventId, bytes, type);
  };
  const auth = deps.auth ?? createAuth(db, env);
  const ai = deps.ai ?? (() => aiConfig(env));
  const allow = rateLimiter(60, 60000);
  const app = new Hono<Vars>().basePath("/api");

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    console.error("[api]", err);
    void recordError(db, {
      source: "server",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      url: `${c.req.method} ${new URL(c.req.url).pathname}`,
    });
    return c.json({ error: "Something went wrong on our side" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  // Daily counts with no one's identity, and crash reports from browsers.
  app.post("/m", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allow(`m:${ip}`)) return c.body(null, 204);
    const raw = (await c.req.json().catch(() => ({}))) as { name?: string };
    if (raw.name === "visit") await count(db, "visit");
    return c.body(null, 204);
  });
  app.post("/errors", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allow(`e:${ip}`)) return c.body(null, 204);
    const e = (await c.req.json().catch(() => ({}))) as { message?: unknown; stack?: unknown; url?: unknown };
    if (typeof e.message === "string" && e.message.trim())
      await recordError(db, {
        source: "client",
        message: e.message,
        stack: typeof e.stack === "string" ? e.stack : undefined,
        url: typeof e.url === "string" ? e.url : undefined,
        userAgent: c.req.header("user-agent"),
      });
    return c.body(null, 204);
  });

  // ------------------------------------------------------------ AI
  app.get("/ai/status", async (c) => {
    const out = await handleAi("status", {}, ai());
    return c.json(out.body as object, {
      status: out.status as 200,
      headers: { "cache-control": "no-store" },
    });
  });
  /** The rate limit, size cap and daily allowance every AI call goes through. */
  const aiGate = async (c: Context, route: string): Promise<{ key: string } | Response> => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
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
    const gate = await aiGate(c, "assistant");
    if (gate instanceof Response) return gate;
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
      await addTokens(db, gate.key, meter.tokens);
    });
  });

  app.post("/ai/:route", async (c) => {
    const route = c.req.param("route");
    const gate = await aiGate(c, route);
    if (gate instanceof Response) return gate;
    const input = await c.req.json().catch(() => undefined);
    const meter = { tokens: 0 };
    const out = await handleAi(route, input, ai(), fetch, meter);
    await addTokens(db, gate.key, meter.tokens);
    return c.json(out.body as object, out.status as 200);
  });

  // ------------------------------------------------------------ accounts
  app.get("/auth/methods", (c) => c.json(signInMethods(env)));
  if (!isProduction(env) && env.PLANNR_DEV_OUTBOX === "1")
    app.get("/dev/outbox/:email", (c) =>
      c.json({ code: devOutbox.get(c.req.param("email").toLowerCase()) ?? null }),
    );
  app.on(["GET", "POST"], "/auth/*", async (c) => {
    const failure: { message?: string } = {};
    const res = await mailFailure.run(failure, () => auth.handler(c.req.raw));
    return failure.message ? c.json({ error: failure.message }, 400) : res;
  });

  // Invite previews are public: someone opening the link may not have an account yet.
  app.get("/invites/:token", async (c) => c.json(await previewInvite(db, c.req.param("token"))));

  // Shared links: RSVPs, helpers, vendors, volunteers, fund reports. No account needed.
  app.get("/p/:token", async (c) =>
    c.json(await publicView(db, c.req.param("token")), 200, { "cache-control": "no-store" }),
  );
  app.post("/p/:token/actions", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allow(`p:${ip}`)) return c.json({ error: "Too many changes at once. Wait a minute." }, 429);
    const { actions } = await body(c, z.object({ actions: z.array(z.unknown()).min(1).max(5) }));
    return c.json(await publicActions(db, c.req.param("token"), actions));
  });
  app.post("/p/:token/photo", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allow(`p:${ip}`)) return c.json({ error: "Too many photos at once. Wait a minute." }, 429);
    const by = (c.req.query("by") ?? "").trim().slice(0, 80);
    if (by.length < 2) throw new HttpError(400, "Add your name, so the family knows whose photo it is");
    const token = c.req.param("token");
    const url = await store(await albumEvent(db, token), c.req.raw);
    const record = { id: "photo", url, by, at: "" };
    return c.json(await publicActions(db, token, [{ type: "addRecord", coll: "album", record }]));
  });

  // Morning reminders, run once a day by Vercel Cron with the project's secret.
  app.get("/cron/daily", async (c) => {
    if (!env.CRON_SECRET || c.req.header("authorization") !== `Bearer ${env.CRON_SECRET}`)
      return c.json({ error: "Not allowed" }, 401);
    await pruneErrors(db).catch(() => undefined);
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const reminders = push
      ? await sendReminders(db, push, today)
      : { skipped: "Reminders aren't configured" };
    // The backup runs after the reminders, so a slow export never delays the morning message.
    const backup = await nightlyBackup(db, env).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      void recordError(db, { source: "server", message: `Backup failed: ${message}`, url: "cron/daily" });
      return { failed: message };
    });
    return c.json({ reminders, backup });
  });
  app.get("/push/key", (c) => c.json({ key: push ? (env.VAPID_PUBLIC_KEY ?? null) : null }));

  // Who is signed in, if anyone: a plain answer either way, so signed-out visitors see no errors.
  app.get("/me", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    return c.json({ user: session?.user ?? null }, 200, { "cache-control": "no-store" });
  });

  // ------------------------------------------------------------ signed in from here on
  const origins = trustedOrigins(env);
  app.use("*", async (c, next) => {
    // Writes only from Plannr's own pages; the session cookie alone isn't proof of intent.
    const origin = c.req.header("origin");
    if (c.req.method !== "GET" && origin && !origins.includes(origin))
      return c.json({ error: "Requests must come from Plannr" }, 403);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Sign in to continue" }, 401);
    c.set("userId", session.user.id);
    await next();
  });

  app.post("/invites/:token/accept", async (c) =>
    c.json(await acceptInvite(db, c.req.param("token"), c.get("userId"))),
  );

  app.get("/events", async (c) => c.json({ plans: await listPlans(db, c.get("userId")) }));

  // ------------------------------------------------------------ the site owner's view
  app.get("/admin/summary", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!isAdmin(env, session?.user.email)) throw new HttpError(404, "Not found");
    return c.json({ ...(await adminSummary(db)), metrics: METRIC_NAMES });
  });

  // ------------------------------------------------------------ your data
  app.get("/account/export", async (c) =>
    c.json(await exportAccount(db, c.get("userId")), 200, {
      "content-disposition": `attachment; filename="plannr-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    }),
  );
  app.post("/account/delete", async (c) => {
    await body(c, z.object({ confirm: z.literal("DELETE") }));
    return c.json(await deleteAccount(db, c.get("userId")));
  });

  // ------------------------------------------------------------ reminders on this device
  const subShape = z.object({
    endpoint: z
      .string()
      .url()
      .max(1000)
      .refine((u) => u.startsWith("https://"), "Not a push address"),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  });
  app.post("/push", async (c) => {
    if (!push) throw new HttpError(503, "Reminders aren't switched on yet");
    const sub = await body(c, subShape);
    const userId = c.get("userId");
    await db
      .insert(pushSubs)
      .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({
        target: pushSubs.endpoint,
        set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });
    await count(db, "push_on");
    await push(
      { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      {
        title: "Reminders are on",
        body: "Each morning Plannr will tell you what's due that day.",
        url: "/today",
        tag: "welcome",
      },
    ).catch(() => false);
    return c.json({ ok: true }, 201);
  });
  app.post("/push/remove", async (c) => {
    const { endpoint } = await body(c, z.object({ endpoint: z.string().max(1000) }));
    await db
      .delete(pushSubs)
      .where(and(eq(pushSubs.endpoint, endpoint), eq(pushSubs.userId, c.get("userId"))));
    return c.json({ ok: true });
  });

  app.get("/activity", async (c) => c.json({ activity: await activity(db, c.get("userId")) }));

  app.post("/events", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_EVENT_BYTES)
      throw new HttpError(413, "That plan is too large");
    const { event } = await body(c, z.object({ event: eventShape }));
    return c.json(await createPlan(db, c.get("userId"), event as unknown as PlannrEvent), 201);
  });

  app.get("/events/:id", async (c) => c.json(await getPlan(db, c.req.param("id"), c.get("userId"))));
  app.post("/events/:id/photo", async (c) => {
    await requireRole(db, c.req.param("id"), c.get("userId"), "planner");
    return c.json({ url: await store(c.req.param("id"), c.req.raw) }, 201);
  });

  app.get("/events/:id/version", async (c) =>
    c.json({ version: await planVersion(db, c.req.param("id"), c.get("userId")) }),
  );

  app.post("/events/:id/actions", async (c) => {
    const { actions } = await body(c, z.object({ actions: z.array(actionShape).min(1).max(50) }));
    const parsed = actions.map((a) => parseAction(a));
    const bad = parsed.find((p) => !p.ok);
    if (bad && !bad.ok) throw new HttpError(400, bad.error);
    return c.json(
      await applyActions(
        db,
        c.req.param("id"),
        c.get("userId"),
        parsed.flatMap((p) => (p.ok ? [p.action] : [])),
      ),
    );
  });

  app.get("/templates", async (c) => c.json({ templates: await listTemplates(db, c.get("userId")) }));
  app.post("/events/:id/template", async (c) => {
    const { name } = await body(c, z.object({ name: z.string().trim().min(1).max(120) }));
    return c.json(await saveTemplate(db, c.get("userId"), c.req.param("id"), name), 201);
  });
  app.post("/templates/:id/use", async (c) => {
    const { name, date } = await body(
      c,
      z.object({ name: z.string().trim().min(1).max(120), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    );
    return c.json(await planFromTemplate(db, c.get("userId"), c.req.param("id"), { name, date }), 201);
  });
  app.delete("/templates/:id", async (c) => {
    await deleteTemplate(db, c.get("userId"), c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/events/:id/links", async (c) =>
    c.json({ links: await listLinks(db, c.req.param("id"), c.get("userId")) }),
  );
  app.post("/events/:id/links", async (c) => {
    const { kind, target } = await body(
      c,
      z.object({ kind: z.string(), target: z.string().max(120).optional() }),
    );
    if (!isLinkKind(kind)) throw new HttpError(400, "Unknown kind of link");
    return c.json(await linkFor(db, c.req.param("id"), c.get("userId"), kind, target ?? ""), 201);
  });
  app.delete("/events/:id/links/:token", async (c) => {
    await revokeLink(db, c.req.param("id"), c.get("userId"), c.req.param("token"));
    return c.json({ ok: true });
  });
  app.put("/events/:id/site-address", async (c) => {
    const { slug } = await body(c, z.object({ slug: z.string().max(60) }));
    return c.json(await renameSite(db, c.req.param("id"), c.get("userId"), slug));
  });

  app.get("/events/:id/history", async (c) =>
    c.json({
      history: await history(db, c.req.param("id"), c.get("userId"), Number(c.req.query("limit") ?? 100)),
    }),
  );

  app.post("/events/:id/history/:change/undo", async (c) =>
    c.json(await undoChange(db, c.req.param("id"), c.get("userId"), c.req.param("change"))),
  );
  app.post("/events/:id/history/:change/redo", async (c) =>
    c.json(await undoChange(db, c.req.param("id"), c.get("userId"), c.req.param("change"), true)),
  );

  app.get("/events/:id/members", async (c) =>
    c.json({ members: await listMembers(db, c.req.param("id"), c.get("userId")) }),
  );
  app.patch("/events/:id/members/:user", async (c) => {
    const patch = await body(
      c,
      z.object({ role: roleShape.optional(), side: z.string().max(60).nullable().optional() }),
    );
    await updateMember(db, c.req.param("id"), c.get("userId"), c.req.param("user"), patch);
    return c.json({ ok: true });
  });
  app.delete("/events/:id/members/:user", async (c) => {
    await removeMember(db, c.req.param("id"), c.get("userId"), c.req.param("user"));
    return c.json({ ok: true });
  });

  app.post("/events/:id/invites", async (c) => {
    const opts = await body(
      c,
      z.object({
        role: roleShape,
        side: z.string().max(60).nullable().optional(),
        maxUses: z.number().int().min(1).max(500).nullable().optional(),
      }),
    );
    return c.json(await createInvite(db, c.req.param("id"), c.get("userId"), opts), 201);
  });

  app.get("/events/:id/comments", async (c) =>
    c.json({
      comments: await listComments(
        db,
        c.req.param("id"),
        c.get("userId"),
        c.req.query("type") ?? "task",
        c.req.query("record") ?? "",
      ),
    }),
  );
  app.post("/events/:id/comments", async (c) => {
    const input = await body(
      c,
      z.object({
        recordType: z.string().min(1).max(30),
        recordId: z.string().min(1).max(120),
        body: z.string().max(2000),
      }),
    );
    return c.json(await addComment(db, c.req.param("id"), c.get("userId"), input), 201);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
