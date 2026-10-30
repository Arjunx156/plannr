import { Hono } from "hono";
import { recordError } from "./admin";
import { type AiConfig, aiConfig, rateLimiter } from "./ai";
import { type Auth, createAuth } from "./auth";
import type { Db } from "./db/types";
import { blobStore, readPhoto, type StorePhoto } from "./photos";
import { HttpError } from "./plans";
import { type PushSender, webPushSender } from "./reminders";
import { accountRoutes } from "./routes/account";
import { aiRoutes } from "./routes/ai";
import { eventRoutes } from "./routes/events";
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
  const limiter = rateLimiter(60, 60000);
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
