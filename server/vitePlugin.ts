import { mkdirSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import type { Connect, Plugin } from "vite";
import { type AppEnv, createApp } from "./app";
import { matchShare, sharePage } from "./share";

/**
 * Serves /api from `vite` and `vite preview` with a Postgres that runs inside the dev
 * server: kept in .data/pglite between restarts, or in memory when PLANNR_DB=memory
 * (the journey tests). Set DATABASE_URL to use a real database instead.
 */
function middleware(env: AppEnv, preview: boolean): Connect.NextHandleFunction {
  let listener: Promise<ReturnType<typeof getRequestListener>> | undefined;
  const start = async () => {
    const db = env.DATABASE_URL
      ? (await import("./db/neon")).createNeonDb(env.DATABASE_URL)
      : await (await import("./db/local")).createLocalDb(env.PLANNR_DB === "memory" ? undefined : dataDir());
    const app = createApp({ db, env });
    return getRequestListener(async (req: Request) => {
      const url = new URL(req.url);
      // In preview, shared links get their titles the way they do on Vercel.
      if (preview && matchShare(url.pathname)) {
        const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf8");
        return new Response(await sharePage(db, html, url), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return app.fetch(req);
    });
  };
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const share = preview && matchShare((req.url ?? "").split("?")[0] ?? "");
    if (!share && !req.url?.startsWith("/api/") && req.url !== "/api") return next();
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
      server.middlewares.use(middleware(merged(), false));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(merged(), true));
    },
  };
}
