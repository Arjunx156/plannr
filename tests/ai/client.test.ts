import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { seedEvents } from "../../src/data/seed";
import { aiEnabled, aiRead, aiWrite, askAi, planNotes, suggestIdeas } from "../../src/lib/ai";
import { extractWithAi } from "../../src/lib/aiIntake";
import { eventFacts, streamAssistantAnswer } from "../../src/lib/assistantClient";
import { emptyProfile } from "../../src/lib/intake";
import { draftPlan } from "../../src/lib/plan";
import { failureLine } from "../../src/pages/plan/sections";
import { demo, personal, stubFetch } from "../support";

const wedding = personal(seedEvents()[0]);
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
  Reflect.set(globalThis, "window", globalThis);
  stubFetch(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const body: Record<string, unknown> | undefined = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push(body === undefined ? { path } : { path, body });
    const handler = routes[path];
    return handler ? handler(body) : json({ error: "Not found" }, 404);
  });
  routes["/api/ai/status"] = () => json({ enabled: true, model: "test" });
});

afterAll(() => {
  globalThis.fetch = realFetch;
  Reflect.deleteProperty(globalThis, "window");
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
    const notes = await planNotes(p, draftPlan(p));
    expect(notes.ok && notes.value.summary).toBe("A fine plan");
    routes["/api/ai/ideas"] = () => json({ ideas: [] });
    expect(await suggestIdeas(wedding)).toBeUndefined();
    const brief = sent("/api/ai/ideas").at(-1)?.body;
    expect(brief?.["avoid"]).toContain("Thalappoli welcome at the entrance");
    // Guests travel as counts only.
    expect(JSON.stringify(brief)).not.toContain(wedding.households?.[0]?.name ?? "—");
  });

  test("a failed call says why, so the plan page can tell the family", async () => {
    const reason = async (respond: Handler) => {
      routes["/api/ai/probe"] = respond;
      const answer = await askAi("probe", {}, 1000);
      return answer.ok ? "answered" : answer.error;
    };
    expect(await reason(() => json({ ok: true }))).toBe("answered");
    expect(await reason(() => json({ error: "Too many requests" }, 429))).toBe("busy");
    expect(await reason(() => json({ error: "AI is not configured on this server" }, 503))).toBe("off");
    expect(await reason(() => json({ error: "AI request failed" }, 502))).toBe("failed");
    expect(await reason(() => new Response("not json"))).toBe("failed");
    expect(
      await reason(() => {
        throw new TypeError("Failed to fetch");
      }),
    ).toBe("offline");
    expect(
      await reason(() => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
    ).toBe("timeout");
  });

  test("each reason has its own words on the plan page", () => {
    const lines = (["off", "offline", "timeout", "busy", "failed"] as const).map(failureLine);
    expect(new Set(lines).size).toBe(lines.length);
    expect(failureLine("offline")).toContain("offline");
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
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => undefined)).toEqual({
      text: "Ordinary answer",
    });
  });

  test("an error before anything showed falls back; after text showed it stops there", async () => {
    routes["/api/ai/assistant/stream"] = () => sse(['event: error\ndata: {"error":"busy"}\n\n']);
    routes["/api/ai/assistant"] = () => json({ text: "Fallback" });
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => undefined)).toEqual({
      text: "Fallback",
    });
    const before = sent("/api/ai/assistant").length;
    routes["/api/ai/assistant/stream"] = () =>
      sse(['event: text\ndata: {"text":"Part"}\n\n', 'event: error\ndata: {"error":"busy"}\n\n']);
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => undefined)).toBeUndefined();
    expect(sent("/api/ai/assistant")).toHaveLength(before);
  });
});

describe("the assistant's facts and its stream, past the happy path", () => {
  test("a committee's facts are its readiness and its money; an empty event has none yet", () => {
    const { mela, empty } = demo();
    const facts = eventFacts(mela);
    expect(facts).toMatchObject({
      readiness: {
        permits: expect.stringContaining("cleared"),
        volunteers: expect.stringContaining("shift"),
      },
      funds: { spent: mela.funds.spent, budget: mela.funds.budget },
    });
    expect(eventFacts(empty)).toMatchObject({ note: "No plan yet" });
  });

  test("other events and empty text events are passed over, and a dropped stream ends the answer", async () => {
    const shown: string[] = [];
    routes["/api/ai/assistant/stream"] = () =>
      sse([
        "event: ping\ndata: {}\n\n",
        'event: text\ndata: {"t":1}\n\n',
        'event: text\ndata: {"text":"Hal',
        "\n\n",
      ]);
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, (t) => shown.push(t))).toBeUndefined();
    expect(shown).toEqual([]);
  });

  test("a stream that can't open falls back to the ordinary answer", async () => {
    routes["/api/ai/assistant/stream"] = () => {
      throw new TypeError("Failed to fetch");
    };
    routes["/api/ai/assistant"] = () => json({ text: "Ordinary answer" });
    expect(await streamAssistantAnswer(wedding, [], "Hi", undefined, () => undefined)).toEqual({
      text: "Ordinary answer",
    });
  });
});

describe("reading a bill or quote", () => {
  const bill = (bytes: number, type = "image/jpeg") =>
    new File([new Uint8Array(bytes).fill(65)], "bill", { type });
  const context = { categories: ["Catering"], guests: 300 };

  test("sends the file as base64 with the plan's categories, and returns what was read", async () => {
    routes["/api/ai/read"] = () => json({ kind: "bill", total: 1200, items: [], payments: [] });
    expect(await aiRead(bill(3), context)).toMatchObject({ kind: "bill", total: 1200 });
    expect(sent("/api/ai/read").at(-1)?.body).toMatchObject({ mime: "image/jpeg", data: "QUFB", ...context });
  });

  test("refuses a file that's too big or of a kind it can't read, before sending anything", async () => {
    const before = sent("/api/ai/read").length;
    await expect(aiRead(bill(3 * 1024 * 1024 + 1), context)).rejects.toThrow("over 3 MB");
    await expect(aiRead(bill(3, "text/plain"), context)).rejects.toThrow("photos (JPG, PNG, WebP) and PDFs");
    expect(sent("/api/ai/read")).toHaveLength(before);
  });

  test("says what went wrong when the server can't read it or can't be reached", async () => {
    routes["/api/ai/read"] = () => json({ error: "That page is too blurry to read" }, 422);
    await expect(aiRead(bill(3), context)).rejects.toThrow("too blurry");
    routes["/api/ai/read"] = () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(aiRead(bill(3), context)).rejects.toThrow("Couldn't reach Plannr");
  });
});
