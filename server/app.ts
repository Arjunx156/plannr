import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { recordError } from "./admin";
import { MAX_BODY, MAX_READ_BODY } from "./ai";
import { type Auth, createAuth } from "./auth";
import type { Db } from "./db/types";
import { type AiConfig, aiConfig } from "./gemini";
import { sharedLimiter } from "./limits";
import { blobStore, MAX_PHOTO_BYTES, readPhoto, type StorePhoto } from "./photos";
import { HttpError } from "./plans";
import { type PushSender, webPushSender } from "./reminders";
import { accountRoutes } from "./routes/account";
import { aiRoutes } from "./routes/ai";
import { eventRoutes, MAX_EVENT_BYTES } from "./routes/events";
import type { Api, AppEnv, RouteDeps, Vars } from "./routes/kit";
import { publicRoutes } from "./routes/public";
import { requireSession } from "./routes/session";

export { addTokens, DAILY_AI, spendAi } from "./routes/ai";
export type { AppEnv } from "./routes/kit";

/**
 * Plannr's API under /api. The same app runs in the Vite dev server, the journey tests,
 * the Bun server and the Vercel function; only the database connection differs.
 * Routes that need no account come first; everything after the session check needs one.
 */
export function createApp(deps: {
  db: Db;
  env: AppEnv;
  auth?: Auth;
  ai?: () => AiConfig;
  photos?: StorePhoto;
  push?: PushSender;
}) {
  const { db, env } = deps;
  const photos = deps.photos ?? blobStore(env.BLOB_READ_WRITE_TOKEN);
  const limiter = sharedLimiter(db, 60, 60000);
  const routes: RouteDeps = {
    db,
    env,
    auth: deps.auth ?? createAuth(db, env),
    ai: deps.ai ?? (() => aiConfig(env)),
    push: deps.push ?? webPushSender(env),
    store: async (eventId, req) => {
      if (!photos) throw new HttpError(503, "Photo uploads aren't switched on yet");
      const { bytes, type } = await readPhoto(req);
      return photos(eventId, bytes, type);
    },
    allow: (key) => limiter(key),
  };
  const app: Api = new Hono<Vars>().basePath("/api");

  // Bodies are counted as they stream in, so a missing or false Content-Length can't get round the cap.
  app.use("*", (c, next) =>
    bodyLimit({
      maxSize: bodyCap(new URL(c.req.url).pathname),
      onError: (c) => c.json({ error: "Request too large" }, 413),
    })(c, next),
  );

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

  publicRoutes(app, routes);
  aiRoutes(app, routes);
  requireSession(app, routes);
  accountRoutes(app, routes);
  eventRoutes(app, routes);
  return app;
}

export type App = ReturnType<typeof createApp>;

/** The most a request body may carry on each kind of route. */
export function bodyCap(path: string): number {
  if (path === "/api/ai/read") return MAX_READ_BODY;
  if (path.startsWith("/api/ai/")) return MAX_BODY;
  if (path.endsWith("/photo")) return MAX_PHOTO_BYTES;
  if (path === "/api/events") return MAX_EVENT_BYTES;
  // Everything else is small JSON: a batch of changes, a comment, a sign-in.
  return MAX_BODY * 4;
}
