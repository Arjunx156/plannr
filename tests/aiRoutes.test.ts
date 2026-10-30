import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { type AiConfig, MAX_BODY } from "../server/ai";
import { type App, createApp, DAILY_AI, spendAi } from "../server/app";
import { createLocalDb } from "../server/db/local";
import { aiUsage } from "../server/db/schema";
import type { Db } from "../server/db/types";

/**
 * The /api/ai/* routes end to end: the burst limit, size cap and daily allowance in front of
 * every call, the token meter behind it, and the streamed assistant. Gemini is faked at fetch.
 */

const ORIGIN = "http://localhost:5173";
const KEYED: AiConfig = { apiKey: "test-key", model: "test-model" };

let db: Db;
let keyed: App;
let keyless: App;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  db = await createLocalDb();
  keyed = createApp({ db, env: {}, ai: () => KEYED });
  keyless = createApp({ db, env: {}, ai: () => ({ model: "test-model" }) });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Each test calls from its own address, so allowances don't leak between tests. */
const ip = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;

function post(app: App, path: string, body: unknown, from: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": from, ...headers },
    body: JSON.stringify(body),
  });
}

/** Answers every Gemini call with `payload` as the model's JSON, and reports 120 tokens used. */
function fakeGemini(payload: unknown): string[] {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    const text = JSON.stringify(payload);
    return Response.json({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { totalTokenCount: 120 },
    });
  }) as typeof fetch;
  return urls;
}

/** Streams the model's JSON in pieces, as Gemini's server-sent events do. */
function fakeGeminiStream(pieces: string[]): void {
  globalThis.fetch = (async (_url: string | URL | Request) => {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        for (const text of pieces)
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`),
          );
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
}

async function usage(key: string) {
  const [row] = await db.select().from(aiUsage).where(eq(aiUsage.key, key));
  return row;
}

describe("status", () => {
  test("says whether AI is on, never caches, and never shows the key", async () => {
    const on = await keyed.request("/api/ai/status");
    expect(await on.json()).toEqual({ enabled: true, model: "test-model" });
    expect(on.headers.get("cache-control")).toBe("no-store");
    const off = await keyless.request("/api/ai/status");
    expect(await off.json()).toEqual({ enabled: false, model: "test-model" });
  });
});

describe("the gate in front of every call", () => {
  test("an unknown route is refused before it counts against anyone", async () => {
    const from = ip();
    const res = await post(keyed, "/api/ai/translate-everything", {}, from);
    expect(res.status).toBe(404);
    expect(await usage(`ip:${from}`)).toBeUndefined();
  });

  test("an oversized request is refused before it reaches the model", async () => {
    const urls = fakeGemini({});
    const res = await post(keyed, "/api/ai/intake", { text: "hi" }, ip(), {
      "content-length": String(MAX_BODY + 1),
    });
    expect(res.status).toBe(413);
    expect(urls).toEqual([]);
  });

  test("once today's allowance is spent, calls get a clear 429 and the model isn't asked", async () => {
    const from = ip();
    await spendAi(db, `ip:${from}`, DAILY_AI.visitor, DAILY_AI.visitor);
    const urls = fakeGemini({});
    const res = await post(keyed, "/api/ai/intake", { text: "A wedding in Kochi" }, from);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toContain("AI limit for today");
    expect(urls).toEqual([]);
  });

  test("without a key the route says so, and the rest of Plannr keeps working", async () => {
    const res = await post(keyless, "/api/ai/intake", { text: "A wedding in Kochi" }, ip());
    expect(res.status).toBe(503);
  });
});

describe("a call that goes through", () => {
  test("returns the cleaned answer and meters its calls and tokens", async () => {
    const from = ip();
    const urls = fakeGemini({ kind: "birthday", city: "Kochi", guests: 30, reply: "Lovely." });
    const res = await post(keyed, "/api/ai/intake", { text: "Aarav's 6th in Kochi, 30 kids" }, from);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ kind: "birthday", city: "Kochi", guests: 30 });
    expect(urls[0]).toContain("/models/test-model:generateContent");
    expect(await usage(`ip:${from}`)).toMatchObject({ calls: 1, tokens: 120 });
  });

  test("reading a document costs more of the allowance than a question", async () => {
    const from = ip();
    fakeGemini({ kind: "quote", items: [], payments: [] });
    await post(keyed, "/api/ai/read", { data: "aGVsbG8=", mimeType: "image/png" }, from);
    expect((await usage(`ip:${from}`))?.calls).toBe(5);
  });
});

describe("the streamed assistant", () => {
  const question = { text: "How much is left?", event: {}, facts: {}, history: [], today: "2026-09-27" };

  test("sends the answer as it's written, then the finished answer", async () => {
    fakeGeminiStream(['{"text": "₹4,20,000 ', 'is left"}']);
    const res = await post(keyed, "/api/ai/assistant/stream", question, ip());
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await res.text();
    expect(events).toContain("event: text");
    expect(events).toContain('"text":"₹4,20,000 is left"');
    expect(events).toContain("event: done");
  });

  test("without a key it answers 503 instead of opening a stream", async () => {
    const res = await post(keyless, "/api/ai/assistant/stream", question, ip());
    expect(res.status).toBe(503);
  });
});
