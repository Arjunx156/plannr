import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { PersonalEvent } from "../src/data/types";
import {
  aiEnabled,
  aiWrite,
  extractWithAi,
  planNotes,
  streamAssistantAnswer,
  suggestIdeas,
} from "../src/lib/ai";
import { emptyProfile } from "../src/lib/intake";
import { draftPlan } from "../src/lib/plan";

const wedding = seedEvents()[0] as PersonalEvent;
const realFetch = globalThis.fetch;
type Handler = (body: Record<string, unknown> | undefined) => Response;
const routes: Record<string, Handler> = {};
const calls: { path: string; body?: Record<string, unknown> }[] = [];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A server-sent event stream that arrives in the given pieces. */
function sse(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}

beforeAll(() => {
  // The client only talks to the server from a browser.
  (globalThis as { window?: unknown }).window = globalThis;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ path, body });
    const handler = routes[path];
    return handler ? handler(body) : json({ error: "Not found" }, 404);
  }) as typeof fetch;
  routes["/api/ai/status"] = () => json({ enabled: true, model: "test" });
});

afterAll(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as { window?: unknown }).window;
});

const sent = (path: string) => calls.filter((c) => c.path === path);

describe("the AI client", () => {
  test("asks once whether the server has AI on", async () => {
    expect(await aiEnabled()).toBe(true);
    expect(await aiEnabled()).toBe(true);
    expect(sent("/api/ai/status")).toHaveLength(1);
  });

  test("writing returns the trimmed text, or nothing when the server can't", async () => {
    routes["/api/ai/write"] = () => json({ text: "  Thank you, Menon family  " });
    expect(await aiWrite({ task: "thanks", lang: "en", text: "Thanks" })).toBe("Thank you, Menon family");
    routes["/api/ai/write"] = () => json({ error: "AI is busy" }, 429);
    expect(await aiWrite({ task: "thanks" })).toBeUndefined();
  });

  test("intake sends the description with what's known so far and today's date", async () => {
    routes["/api/ai/intake"] = () => json({ kind: "wedding", city: "Kochi" });
    expect(await extractWithAi("Wedding in Kochi", emptyProfile(), "city")).toEqual({
      kind: "wedding",
      city: "Kochi",
    });
    expect(sent("/api/ai/intake").at(-1)?.body).toMatchObject({ text: "Wedding in Kochi", asking: "city" });
  });

  test("plan notes and ideas go with the plan, and an empty answer counts as none", async () => {
    routes["/api/ai/plan"] = () => json({ summary: "A fine plan", tips: [], watchouts: [], ideas: [] });
    const p = { ...emptyProfile(), kind: "wedding" as const, guests: 200, budget: 1_500_000 };
    expect((await planNotes(p, draftPlan(p)))?.summary).toBe("A fine plan");
    routes["/api/ai/ideas"] = () => json({ ideas: [] });
    expect(await suggestIdeas(wedding)).toBeUndefined();
    const brief = sent("/api/ai/ideas").at(-1)?.body;
    expect(brief?.avoid).toContain("Thalappoli welcome at the entrance");
    // Guests travel as counts only.
    expect(JSON.stringify(brief)).not.toContain(wedding.households?.[0]?.name ?? "—");
  });
});

describe("the assistant's streamed answer", () => {
  test("shows the answer as it's written, even when an event is split across pieces", async () => {
    const shown: string[] = [];
    routes["/api/ai/assistant/stream"] = () =>
      sse([
        'event: text\ndata: {"text":"The haldi"}\n\n',
        'event: text\ndata: {"text":"The haldi is on Fri',
        'day."}\n\nevent: done\ndata: {"text":"The haldi is on Friday."}\n\n',
      ]);
    const out = await streamAssistantAnswer(wedding, [], "When is the haldi?", "en", (t) => shown.push(t));
    expect(shown).toEqual(["The haldi", "The haldi is on Friday."]);
    expect(out).toEqual({ text: "The haldi is on Friday." });
  });

  test("asks the ordinary way when streaming isn't available", async () => {
    routes["/api/ai/assistant/stream"] = () => json({ error: "Not here" }, 404);
    routes["/api/ai/assistant"] = () => json({ text: "Ordinary answer" });
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => {})).toEqual({
      text: "Ordinary answer",
    });
  });

  test("an error before anything showed falls back; after text showed it stops there", async () => {
    routes["/api/ai/assistant/stream"] = () => sse(['event: error\ndata: {"error":"busy"}\n\n']);
    routes["/api/ai/assistant"] = () => json({ text: "Fallback" });
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => {})).toEqual({ text: "Fallback" });
    const before = sent("/api/ai/assistant").length;
    routes["/api/ai/assistant/stream"] = () =>
      sse(['event: text\ndata: {"text":"Part"}\n\n', 'event: error\ndata: {"error":"busy"}\n\n']);
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => {})).toBeUndefined();
    expect(sent("/api/ai/assistant")).toHaveLength(before);
  });
});
