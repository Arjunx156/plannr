import { type Context, Hono } from "hono";
import { z } from "zod";
import type { PlannrEvent } from "../src/data/types";
import { EVENT_ACTION_TYPES, type EventAction } from "../src/shared/engine";
import { type AiConfig, aiConfig, handleAi, MAX_BODY, rateLimiter } from "./ai";
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
import type { Db } from "./db/types";
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
  undoChange,
  updateMember,
} from "./plans";

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

export function createApp(deps: { db: Db; env: AppEnv; auth?: Auth; ai?: () => AiConfig }) {
  const { db, env } = deps;
  const auth = deps.auth ?? createAuth(db, env);
  const ai = deps.ai ?? (() => aiConfig(env));
  const allow = rateLimiter(60, 60000);
  const app = new Hono<Vars>().basePath("/api");

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    console.error("[api]", err);
    return c.json({ error: "Something went wrong on our side" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  // ------------------------------------------------------------ AI
  app.get("/ai/status", async (c) => {
    const out = await handleAi("status", {}, ai());
    return c.json(out.body as object, {
      status: out.status as 200,
      headers: { "cache-control": "no-store" },
    });
  });
  app.post("/ai/:route", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!allow(`ai:${ip}`)) return c.json({ error: "Too many requests" }, 429);
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY)
      return c.json({ error: "Request too large" }, 413);
    const input = await c.req.json().catch(() => undefined);
    const out = await handleAi(c.req.param("route"), input, ai());
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

  app.get("/me", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return c.json({ user: session?.user ?? null });
  });

  app.post("/invites/:token/accept", async (c) =>
    c.json(await acceptInvite(db, c.req.param("token"), c.get("userId"))),
  );

  app.get("/events", async (c) => c.json({ plans: await listPlans(db, c.get("userId")) }));

  app.get("/activity", async (c) => c.json({ activity: await activity(db, c.get("userId")) }));

  app.post("/events", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_EVENT_BYTES)
      throw new HttpError(413, "That plan is too large");
    const { event } = await body(c, z.object({ event: eventShape }));
    return c.json(await createPlan(db, c.get("userId"), event as unknown as PlannrEvent), 201);
  });

  app.get("/events/:id", async (c) => c.json(await getPlan(db, c.req.param("id"), c.get("userId"))));

  app.get("/events/:id/version", async (c) =>
    c.json({ version: await planVersion(db, c.req.param("id"), c.get("userId")) }),
  );

  app.post("/events/:id/actions", async (c) => {
    const { actions } = await body(c, z.object({ actions: z.array(actionShape).min(1).max(50) }));
    return c.json(
      await applyActions(db, c.req.param("id"), c.get("userId"), actions as unknown as EventAction[]),
    );
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
