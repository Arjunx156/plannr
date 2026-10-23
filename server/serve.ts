/**
 * Self-hosted production server: the built app from dist/ and the API on one port.
 * Uses Neon when DATABASE_URL is set, otherwise a Postgres kept in .data/pglite.
 * Run `bun run build && bun run start`.
 */
import { mkdirSync } from "node:fs";
import { join, normalize } from "node:path";
import { type AppEnv, createApp } from "./app";

const DIST = join(import.meta.dir, "..", "dist");
const env = process.env as AppEnv;
// A self-hosted server is production unless told otherwise: it needs BETTER_AUTH_SECRET.
env.PLANNR_ENV ??= "production";
const port = Number(env.PORT ?? 3000);

async function database() {
  if (env.DATABASE_URL) return (await import("./db/neon")).createNeonDb(env.DATABASE_URL);
  const dir = join(import.meta.dir, "..", ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  return (await import("./db/local")).createLocalDb(dir);
}

const api = createApp({ db: await database(), env });

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return api.fetch(req);
    const path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = Bun.file(join(DIST, path));
    if (path !== "/" && (await file.exists())) {
      const immutable = path.startsWith("/assets/");
      return new Response(file, {
        headers: immutable ? { "cache-control": "public, max-age=31536000, immutable" } : {},
      });
    }
    // Client-side routes all render index.html.
    return new Response(Bun.file(join(DIST, "index.html")), { headers: { "content-type": "text/html" } });
  },
});

console.log(
  `Plannr on http://localhost:${server.port} · AI ${env.GEMINI_API_KEY ? "on" : "off"} · database ${env.DATABASE_URL ? "Neon" : "local"}`,
);
