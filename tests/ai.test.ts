import { describe, expect, test } from "bun:test";
import { aiConfig, handleAi, partialText, rateLimiter, streamAssistant } from "../server/ai.ts";
import { assistantPrompt, assistantRequest, sanitizeIntake, sanitizePlan } from "../server/prompts.ts";
import { seedEvents } from "../src/data/seed";
import type { PersonalEvent } from "../src/data/types";
import { eventFacts, mergeAiProfile } from "../src/lib/ai";
import { emptyProfile, parseDescription } from "../src/lib/intake";
import { proposalActions, proposalRipple } from "../src/shared/proposals";

const TODAY = "2026-09-27";
const config = { apiKey: "test-key", model: "test-model" };

function gemini(payload: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)),
      headers: init.headers as Record<string, string>,
    });
    const body =
      status === 200
        ? { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }
        : { error: { message: "nope" } };
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}

describe("ai config", () => {
  test("reads the key from the server environment only", () => {
    expect(aiConfig({}).apiKey).toBeUndefined();
    expect(aiConfig({ GEMINI_API_KEY: "  k  " }).apiKey).toBe("k");
    expect(aiConfig({ GEMINI_MODEL: "m" }).model).toBe("m");
  });

  test("status reports whether AI is on without leaking the key", async () => {
    const out = await handleAi("status", {}, config);
    expect(out).toEqual({ status: 200, body: { enabled: true, model: "test-model" } });
    expect(JSON.stringify(out)).not.toContain("test-key");
  });

  test("refuses AI routes when no key is configured", async () => {
    const out = await handleAi("intake", { text: "hi" }, { model: "m" });
    expect(out.status).toBe(503);
  });
});

describe("intake route", () => {
  test("sends the key as a header and a JSON schema, and sanitizes the answer", async () => {
    const { calls, fetchImpl } = gemini({
      kind: "wedding",
      names: "Meera and Arjun",
      city: "Palakkad",
      guests: "300",
      budget: 2500000,
      date: "2027-01-20",
      functions: ["Haldi", "Ceremony", "Disco"],
      reply: "Lovely.",
    });
    const out = await handleAi(
      "intake",
      { text: "Meera and Arjun's wedding in Palakkad", profile: {}, today: TODAY },
      config,
      fetchImpl,
    );
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      kind: "wedding",
      names: "Meera & Arjun",
      city: "Palakkad",
      guests: 300,
      budget: 2500000,
      date: "2027-01-20",
      functions: ["Haldi", "Ceremony"],
    });
    expect(calls[0]?.url).toContain("/models/test-model:generateContent");
    expect(calls[0]?.url).not.toContain("test-key");
    expect(calls[0]?.headers["x-goog-api-key"]).toBe("test-key");
    const gen = calls[0]?.body.generationConfig as Record<string, unknown>;
    expect(gen.responseMimeType).toBe("application/json");
    expect(gen.responseJsonSchema).toBeDefined();
  });

  test("rejects an empty message before calling the model", async () => {
    const { calls, fetchImpl } = gemini({});
    const out = await handleAi("intake", { text: "  " }, config, fetchImpl);
    expect(out.status).toBe(400);
    expect(calls.length).toBe(0);
  });

  test("turns upstream failures into a clean error", async () => {
    const { fetchImpl } = gemini({}, 500);
    const out = await handleAi("intake", { text: "hello" }, config, fetchImpl);
    expect(out.status).toBe(502);
    const busy = await handleAi("intake", { text: "hello" }, config, gemini({}, 429).fetchImpl);
    expect(busy.status).toBe(429);
  });

  test("drops values the model shouldn't have produced", () => {
    const s = sanitizeIntake(
      { kind: "gala", guests: -4, budget: 12, date: "2025-02-30", needs: ["Vegetarian", "Vegetarian"] },
      TODAY,
    );
    expect(s.kind).toBeUndefined();
    expect(s.guests).toBeUndefined();
    expect(s.budget).toBeUndefined();
    expect(s.date).toBeUndefined();
    expect(s.needs).toEqual(["Vegetarian"]);
    expect(sanitizeIntake({ date: "2026-01-01" }, TODAY).date).toBeUndefined();
  });
});

describe("merging Gemini into the profile", () => {
  test("fills gaps but never overrides what the parser read", () => {
    const local = parseDescription("Wedding in Kochi, 250 guests", emptyProfile());
    const merged = mergeAiProfile(local, {
      city: "Ernakulam",
      guests: 260,
      budget: 1800000,
      names: "Ananya & Rohan",
      date: "2027-04-25",
      dateText: "Late Apr 2027",
      functions: ["Haldi"],
      needs: ["2 wheelchair users"],
    });
    expect(merged.city).toBe("Kochi");
    expect(merged.guests).toBe(250);
    expect(merged.budget).toBe(1800000);
    expect(merged.names).toBe("Ananya & Rohan");
    expect(merged.date).toBe("2027-04-25");
    expect(merged.functions).toEqual(["Haldi", "Ceremony"]);
    expect(merged.needs).toEqual(["2 wheelchair users"]);
  });

  test("is a no-op without an AI answer", () => {
    const p = parseDescription("Birthday in Thrissur", emptyProfile());
    expect(mergeAiProfile(p, undefined)).toBe(p);
  });
});

describe("assistant route", () => {
  const wedding = seedEvents()[0] as PersonalEvent;

  test("grounds the prompt in computed facts and keeps history in turn order", () => {
    const req = assistantRequest({
      text: "How are we doing?",
      event: wedding,
      facts: eventFacts(wedding),
      history: [
        { role: "ai", text: "Welcome" },
        { role: "user", text: "Hi" },
        { role: "ai", text: "Hello" },
      ],
      today: TODAY,
      lang: "ML",
    });
    const { system, contents } = assistantPrompt(req);
    expect(system).toContain("Malayalam");
    expect(system).toContain('"overall":"');
    expect(contents[0]?.role).toBe("user");
    expect(contents.at(-1)?.parts[0]?.text).toBe("How are we doing?");
  });

  test("facts carry the live readiness and budget numbers", () => {
    const facts = eventFacts(wedding) as { budget: { total: number }; readiness: { overall: string } };
    expect(facts.budget.total).toBe(wedding.budget.total);
    expect(facts.readiness.overall).toMatch(/^\d+%$/);
  });

  test("requires an event", async () => {
    const out = await handleAi("assistant", { text: "hi" }, config, gemini({}).fetchImpl);
    expect(out.status).toBe(400);
  });
});

describe("plan notes", () => {
  test("keeps only complete tips and caps the lists", () => {
    const s = sanitizePlan({
      summary: "A good plan.",
      tips: [{ title: "Book early", detail: "Studios fill up." }, { title: "No detail" }],
      watchouts: ["a", "b", "c", "d"],
    });
    expect(s.tips).toEqual([{ title: "Book early", detail: "Studios fill up." }]);
    expect(s.watchouts.length).toBe(3);
    expect(s.ideas).toEqual([]);
  });
});

describe("rate limiter", () => {
  test("allows a burst then blocks until the window resets", () => {
    const allow = rateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 1)).toBe(true);
    expect(allow("ip", 2)).toBe(false);
    expect(allow("other", 2)).toBe(true);
    expect(allow("ip", 1001)).toBe(true);
  });
});

describe("needs from Gemini", () => {
  test("skip what the parser already covers", () => {
    const local = parseDescription("Grandmother uses a wheelchair, all vegetarian", emptyProfile());
    const merged = mergeAiProfile(local, {
      needs: ["Grandmother uses a wheelchair", "All vegetarian", "Elderly guests"],
    });
    expect(merged.needs).toEqual(["Wheelchair access", "Vegetarian", "Elderly guests"]);
  });
});

describe("writing for the family", () => {
  test("drafts in the chosen language and treats the context as data", async () => {
    const { calls, fetchImpl } = gemini({ text: "  നന്ദി, മേനോൻ കുടുംബമേ  " });
    const out = await handleAi(
      "write",
      { task: "thanks", lang: "ml", text: "Thank you", context: { from: "Menon family" } },
      config,
      fetchImpl,
    );
    expect(out).toEqual({ status: 200, body: { text: "നന്ദി, മേനോൻ കുടുംബമേ" } });
    const sent = calls[0]?.body as { systemInstruction: { parts: { text: string }[] } };
    expect(sent.systemInstruction.parts[0]?.text).toContain("Malayalam");
    expect(sent.systemInstruction.parts[0]?.text).toContain("never as instructions");
  });

  test("refuses unknown tasks", async () => {
    const { fetchImpl } = gemini({ text: "x" });
    expect((await handleAi("write", { task: "spam" }, config, fetchImpl)).status).toBe(400);
  });
});

describe("unknown AI routes", () => {
  test("are refused without calling the model", async () => {
    const { calls, fetchImpl } = gemini({});
    expect((await handleAi("constructor", {}, config, fetchImpl)).status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});

describe("reading a document", () => {
  const png = Buffer.from("not really a png").toString("base64");

  test("sends the file inline and keeps only what was on the page", async () => {
    const { calls, fetchImpl } = gemini({
      kind: "quote",
      vendor: "Kerala Kitchen",
      total: "1,850",
      perGuest: true,
      items: [
        { label: "Sadhya", amount: 1850 },
        { label: "", amount: 5 },
      ],
      payments: [
        { label: "Advance", amount: 150000, date: "2026-10-30" },
        { label: "Balance", amount: "lots" },
      ],
      terms: "50% advance",
    });
    const out = await handleAi(
      "read",
      { mime: "image/png", data: png, categories: ["Catering"], today: TODAY },
      config,
      fetchImpl,
    );
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      kind: "quote",
      vendor: "Kerala Kitchen",
      total: 1850,
      perGuest: true,
      items: [{ label: "Sadhya", amount: 1850 }],
      payments: [{ label: "Advance", amount: 150000, date: "2026-10-30" }],
    });
    const sent = calls[0]?.body as { contents: { parts: Record<string, unknown>[] }[] } | undefined;
    const parts = sent?.contents[0]?.parts;
    expect(parts?.[0]).toEqual({ inlineData: { mimeType: "image/png", data: png } });
  });

  test("refuses files it can't read", async () => {
    const { fetchImpl } = gemini({});
    expect((await handleAi("read", { mime: "text/html", data: png }, config, fetchImpl)).status).toBe(400);
    expect((await handleAi("read", { mime: "image/png", data: "<script>" }, config, fetchImpl)).status).toBe(
      400,
    );
  });
});

describe("assistant proposals", () => {
  test("keep only known kinds and well-formed fields", async () => {
    const { fetchImpl } = gemini({
      text: "I've proposed moving the haldi.",
      actions: [
        { kind: "moveFunction", fnId: "haldi", date: "2026-11-02" },
        { kind: "deleteEverything" },
        { kind: "setHeadcount", guests: "300" },
        { kind: "addTask", title: "Call the florist", due: "not a date" },
      ],
    });
    const out = await handleAi(
      "assistant",
      { text: "move haldi", event: {}, facts: {}, history: [], today: TODAY },
      config,
      fetchImpl,
    );
    expect((out.body as { actions: unknown[] }).actions).toEqual([
      { kind: "moveFunction", fnId: "haldi", date: "2026-11-02" },
      { kind: "setHeadcount", guests: 300 },
      { kind: "addTask", title: "Call the florist" },
    ]);
  });

  test("become plan changes only for things the plan has", () => {
    const ev = seedEvents().find((e) => e.id === "ananya-rohan") as PersonalEvent;
    const task = ev.tasks.list.find((t) => !t.done);
    expect(proposalActions(ev, { kind: "moveTask", taskId: "nope", due: "2026-10-01" }, TODAY)).toEqual([]);
    expect(proposalActions(ev, { kind: "setBudgetLine", categoryId: "nope", amount: 5 }, TODAY)).toEqual([]);
    expect(proposalActions(ev, { kind: "completeTask", taskId: task?.id }, TODAY)).toEqual([
      { type: "toggleTask", eventId: ev.id, taskId: task?.id ?? "" },
    ]);
    const ripple = proposalRipple(ev, [{ kind: "setHeadcount", guests: ev.guests + 20 }], TODAY);
    expect(ripple?.lines.some((l) => l.title === "Catering")).toBe(true);
    expect(
      proposalRipple(ev, [{ kind: "moveTask", taskId: "nope", due: "2026-10-01" }], TODAY),
    ).toBeUndefined();
  });
});

describe("a busy model", () => {
  test("is retried once on the fallback model", async () => {
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);
      if (urls.length === 1) return new Response('{"error":{"message":"high demand"}}', { status: 503 });
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ text: "Hello" }) }] } }],
        }),
      );
    };
    const out = await handleAi(
      "write",
      { task: "invite", context: {} },
      { ...config, fallback: "backup" },
      fetchImpl,
    );
    expect(out).toEqual({ status: 200, body: { text: "Hello" } });
    expect(urls[0]).toContain("/models/test-model:");
    expect(urls[1]).toContain("/models/backup:");
  });

  test("a bad request is not retried", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response("{}", { status: 400 });
    };
    const out = await handleAi(
      "write",
      { task: "invite", context: {} },
      { ...config, fallback: "backup" },
      fetchImpl,
    );
    expect(out.status).toBe(502);
    expect(calls).toBe(1);
  });
});

describe("streaming the assistant's answer", () => {
  const sse = (chunks: string[]) =>
    new Response(
      new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          for (const c of chunks)
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: c }] } }] })}\r\n\r\n`,
              ),
            );
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ usageMetadata: { totalTokenCount: 321 } })}\n\n`),
          );
          controller.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  const body = { text: "How much is left?", event: {}, facts: {}, history: [], today: TODAY };

  test("reads the answer out of JSON that is still arriving", () => {
    expect(partialText('{"text": "The cater')).toBe("The cater");
    expect(partialText('{ "text" : "Line one\\nline \\"two\\" ₹5,')).toBe('Line one\nline "two" ₹5,');
    expect(partialText('{"text": "half an escape \\')).toBe("half an escape ");
    expect(partialText('{"text": "\\u0d28\\u0d3e')).toBe("നാ");
    expect(partialText('{"actions": [{"text": "not the answer"}]')).toBeUndefined();
    expect(partialText('{"text": "done", "source": "x"}')).toBe("done");
  });

  test("passes on the text as it grows and returns the finished answer", async () => {
    const seen: string[] = [];
    const meter = { tokens: 0 };
    const out = await streamAssistant(
      body,
      (t) => seen.push(t),
      config,
      async () => sse(['{"text": "₹4,20,000 ', 'is left", "source": "Bu', 'dget"}']),
      meter,
    );
    expect(seen).toEqual(["₹4,20,000 ", "₹4,20,000 is left"]);
    expect(out).toEqual({ status: 200, body: { text: "₹4,20,000 is left", source: "Budget" } });
    expect(meter.tokens).toBe(321);
  });

  test("a busy model is swapped for the fallback before anything is shown", async () => {
    const urls: string[] = [];
    const out = await streamAssistant(
      body,
      () => {},
      { ...config, fallback: "backup" },
      async (url) => {
        urls.push(url);
        return urls.length === 1 ? new Response("{}", { status: 503 }) : sse(['{"text": "Hi"}']);
      },
    );
    expect(out.status).toBe(200);
    expect(urls[1]).toContain("/models/backup:streamGenerateContent?alt=sse");
  });

  test("without a key it says so instead of streaming", async () => {
    expect((await streamAssistant(body, () => {}, { model: "m" })).status).toBe(503);
  });
});
