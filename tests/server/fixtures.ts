import { expect } from "bun:test";
import { type App, createApp } from "../../server/app";
import { createLocalDb } from "../../server/db/local";
import type { PersonalEvent } from "../../src/data/types";
import { demo } from "../support";

/** Time for a test that starts its own database: PGlite takes seconds to boot and migrate. */
export const OWN_DB_MS = 30_000;

/** The dev server's origin; Better Auth refuses changes from anywhere else. */
export const ORIGIN = "http://localhost:5173";

let shared: Promise<App> | undefined;

/**
 * The API on an in-memory database, with the dev outbox on so email codes can be read back. One
 * app serves every server test file: each test signs in its own people and saves its own events,
 * and starting PGlite takes seconds.
 */
export function testApp(): Promise<App> {
  shared ??= createLocalDb().then((db) => createApp({ db, env: { PLANNR_DEV_OUTBOX: "1" } }));
  return shared;
}

/** The demo wedding under a new id, so every test saves its own copy. */
export function wedding(): PersonalEvent {
  return { ...demo().wedding, id: `wedding-${crypto.randomUUID().slice(0, 8)}` };
}

/** A response's status, and its body as parsed JSON. */
export interface Reply {
  status: number;
  // JSON.parse gives `any`: tests read replies field by field, and a wrong path fails the assertion.
  // biome-ignore lint/suspicious/noExplicitAny: see above
  json: any;
}

/** A browser with its own cookie jar, talking to one app. */
export class Client {
  readonly cookies: Map<string, string> = new Map();
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** Calls the API as this browser would: a POST when there's a body, a GET otherwise. */
  async call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Reply> {
    const res = await this.app.request(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: this.headers(init.body !== undefined),
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    this.keepCookies(res);
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  /** Signs in as a guest and returns the new user's id. */
  async guest(): Promise<string> {
    const res = await this.call("/api/auth/sign-in/anonymous", { body: {} });
    expect(res.status).toBe(200);
    return String(res.json.user.id);
  }

  private headers(json: boolean): Record<string, string> {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (json) headers["content-type"] = "application/json";
    if (this.cookies.size > 0) headers["cookie"] = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    return headers;
  }

  private keepCookies(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [name, ...rest] = (pair ?? "").split("=");
      if (name) this.cookies.set(name.trim(), rest.join("="));
    }
  }
}
