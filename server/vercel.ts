/**
 * The Vercel function: the whole API, bundled into one file by scripts/vercel-build.ts.
 * Without a database (before Neon is connected) it still serves the AI routes and tells
 * the app that accounts aren't available yet, so the site keeps working in demo mode.
 */
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { aiConfig, handleAi } from "./ai";
import { type AppEnv, createApp } from "./app";
import { createNeonDb } from "./db/neon";

function offline(env: AppEnv) {
  const app = new Hono().basePath("/api");
  app.get("/health", (c) => c.json({ ok: true, database: false }));
  app.get("/auth/methods", (c) => c.json({ guest: false, email: false, google: false }));
  app.get("/ai/status", async (c) => {
    const out = await handleAi("status", {}, aiConfig(env));
    return c.json(out.body as object, out.status as 200);
  });
  app.post("/ai/:route", async (c) => {
    const out = await handleAi(
      c.req.param("route"),
      await c.req.json().catch(() => undefined),
      aiConfig(env),
    );
    return c.json(out.body as object, out.status as 200);
  });
  app.all("*", (c) =>
    c.json({ error: "Accounts aren't switched on yet: the database isn't connected" }, 503),
  );
  return app;
}

const env = process.env as AppEnv;
const app = env.DATABASE_URL ? createApp({ db: createNeonDb(env.DATABASE_URL), env }) : offline(env);

export default getRequestListener(app.fetch);
