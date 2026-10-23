import { mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import type { Connect, Plugin } from "vite";
import { type AppEnv, createApp } from "./app";

/**
 * Serves /api from `vite` and `vite preview` with a Postgres that runs inside the dev
 * server: kept in .data/pglite between restarts, or in memory when PLANNR_DB=memory
 * (the journey tests). Set DATABASE_URL to use a real database instead.
 */
function middleware(env: AppEnv): Connect.NextHandleFunction {
  let listener: Promise<ReturnType<typeof getRequestListener>> | undefined;
  const start = async () => {
    const db = env.DATABASE_URL
      ? (await import("./db/neon")).createNeonDb(env.DATABASE_URL)
      : await (await import("./db/local")).createLocalDb(env.PLANNR_DB === "memory" ? undefined : dataDir());
    return getRequestListener(createApp({ db, env }).fetch);
  };
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    if (!req.url?.startsWith("/api/") && req.url !== "/api") return next();
    try {
      listener ??= start();
      await (await listener)(req, res);
    } catch (e) {
      console.error("[api] failed to start:", e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "The local API failed to start" }));
    }
  };
}

function dataDir(): string {
  const dir = join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function plannrApi(env: Record<string, string | undefined>): Plugin {
  const merged = () => ({ ...env, ...process.env }) as AppEnv;
  return {
    name: "plannr-api",
    configureServer(server) {
      server.middlewares.use(middleware(merged()));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(merged()));
    },
  };
}
