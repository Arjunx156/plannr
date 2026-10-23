/**
 * The Gemini routes on Vercel: /api/ai/status, /intake, /assistant and /plan, served by
 * the same handler as the dev server and the Bun server.
 */
import { aiConfig, handleAi, MAX_BODY, rateLimiter } from "../../server/ai.js";

const allow = rateLimiter();

function routeOf(req: Request): string {
  return new URL(req.url).pathname.replace(/^\/api\/ai\//, "").replace(/\/+$/, "");
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: Request): Promise<Response> {
  const route = routeOf(req);
  if (route !== "status") return json(405, { error: "Use POST" });
  const out = await handleAi("status", {}, aiConfig());
  return json(out.status, out.body);
}

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return json(429, { error: "Too many requests" });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY)
    return json(413, { error: "Request too large" });
  const body = await req.json().catch(() => undefined);
  const out = await handleAi(routeOf(req), body, aiConfig());
  return json(out.status, out.body);
}
