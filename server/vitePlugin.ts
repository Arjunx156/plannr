import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect, Plugin } from "vite";
import { type AiConfig, aiConfig, handleAi, MAX_BODY, rateLimiter } from "./ai.ts";

const PREFIX = "/api/ai/";

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", reject);
  });
}

function middleware(getConfig: () => AiConfig): Connect.NextHandleFunction {
  const allow = rateLimiter();
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    if (!req.url?.startsWith(PREFIX)) return next();
    const route = req.url.slice(PREFIX.length).split("?")[0] ?? "";
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    };
    if (route !== "status" && req.method !== "POST") return send(405, { error: "Use POST" });
    if (route !== "status" && !allow(req.socket.remoteAddress ?? "local"))
      return send(429, { error: "Too many requests" });
    try {
      const body = req.method === "POST" ? await readBody(req) : {};
      const out = await handleAi(route, body, getConfig());
      send(out.status, out.body);
    } catch {
      send(413, { error: "Request too large" });
    }
  };
}

/** Serves /api/ai/* from `vite` and `vite preview`, reading the key from .env.local. */
export function plannrAi(env: Record<string, string | undefined>): Plugin {
  const getConfig = () => aiConfig({ ...env, ...process.env });
  return {
    name: "plannr-ai",
    configureServer(server) {
      server.middlewares.use(middleware(getConfig));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(getConfig));
    },
  };
}
