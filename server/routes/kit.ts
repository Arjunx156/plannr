import type { Context, Hono } from "hono";
import type { BlankSchema } from "hono/types";
import type { z } from "zod";
import { type AiConfig, MAX_BODY } from "../ai";
import type { Auth, AuthEnv } from "../auth";
import type { Db } from "../db/types";
import { HttpError } from "../plans";
import type { PushSender } from "../reminders";

/** Settings the API reads from the environment. */
export type AppEnv = AuthEnv &
  Record<string, string | undefined> & {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    /** Development and tests only: lets the journey tests read the last email code. */
    PLANNR_DEV_OUTBOX?: string;
  };

/** What a signed-in request carries once the session check has passed. */
export interface Vars {
  Variables: { userId: string };
}

/** The API app, mounted under /api. */
export type Api = Hono<Vars, BlankSchema, "/api">;

/** What every group of routes is given: the database, the settings and the services built from them. */
export interface RouteDeps {
  db: Db;
  env: AppEnv;
  auth: Auth;
  ai: () => AiConfig;
  /** Sends a web push message; absent when reminders aren't configured. */
  push: PushSender | undefined;
  /** Stores an uploaded photo for an event and returns its address. */
  store: (eventId: string, req: Request) => Promise<string>;
  /** A burst limiter per server instance, keyed by purpose and address. */
  allow: (key: string) => boolean;
}

/** The caller's address, as Vercel's proxy reports it. */
export function clientIp(c: Context): string {
  return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Reads and checks a JSON body against its shape; too large, malformed or wrong-shaped requests get a 4xx. */
export async function body<T>(c: Context, shape: z.ZodType<T>): Promise<T> {
  const length = Number(c.req.header("content-length") ?? 0);
  if (length > MAX_BODY * 4) throw new HttpError(413, "Request too large");
  const raw = await c.req.json().catch(() => {
    throw new HttpError(400, "Expected JSON");
  });
  const parsed = shape.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  return parsed.data;
}
