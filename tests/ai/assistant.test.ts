/** The assistant: its route, the changes it proposes, and its streamed answer. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { handleAi } from "../../server/ai.ts";
import { partialText, streamAssistant } from "../../server/aiStream.ts";
import { assistantPrompt, assistantRequest } from "../../server/prompts/assistant.ts";
import { seedEvents } from "../../src/data/seed";
import { eventFacts } from "../../src/lib/assistantClient.ts";
import { proposalActions, proposalRipple } from "../../src/shared/proposals";
import { personal } from "../support";
import { config, gemini, TODAY } from "./fixtures";

describe("assistant route", () => {
  const wedding = personal(seedEvents()[0]);

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
    expect(eventFacts(wedding)).toMatchObject({
      budget: { total: wedding.budget.total },
      readiness: { overall: expect.stringMatching(/^\d+%$/) },
    });
  });

  test("requires an event", async () => {
    const out = await handleAi("assistant", { text: "hi" }, config, gemini({}).fetchImpl);
    expect(out.status).toBe(400);
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
    expect(z.object({ actions: z.array(z.unknown()) }).parse(out.body).actions).toEqual([
      { kind: "moveFunction", fnId: "haldi", date: "2026-11-02" },
      { kind: "setHeadcount", guests: 300 },
      { kind: "addTask", title: "Call the florist" },
    ]);
  });

  test("become plan changes only for things the plan has", () => {
    const ev = personal(seedEvents().find((e) => e.id === "ananya-rohan"));
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
      () => undefined,
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
    expect((await streamAssistant(body, () => undefined, { model: "m" })).status).toBe(503);
  });
});
