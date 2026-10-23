/**
 * Production server: serves the built app from dist/ and the Gemini routes from the
 * same origin, so the key stays on the server. Run `bun run build && bun run start`.
 */
import { join, normalize } from "node:path";
import { aiConfig, handleAi, MAX_BODY, rateLimiter } from "./ai.ts";

const DIST = join(import.meta.dir, "..", "dist");
const port = Number(process.env.PORT ?? 3000);
const allow = rateLimiter();
const json = (status: number, body: unknown) => Response.json(body, { status });

const server = Bun.serve({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/ai/")) {
      const route = url.pathname.slice("/api/ai/".length);
      if (route !== "status") {
        if (req.method !== "POST") return json(405, { error: "Use POST" });
        if (!allow(srv.requestIP(req)?.address ?? "unknown"))
          return json(429, { error: "Too many requests" });
        if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
          return json(413, { error: "Request too large" });
      }
      const body = req.method === "POST" ? await req.json().catch(() => undefined) : {};
      const out = await handleAi(route, body, aiConfig());
      return json(out.status, out.body);
    }
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

const ai = aiConfig();
console.log(
  `Plannr on http://localhost:${server.port} · AI ${ai.apiKey ? `on (${ai.model})` : "off: set GEMINI_API_KEY"}`,
);
