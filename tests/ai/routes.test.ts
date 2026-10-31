/** The other AI routes: plan notes, needs, writing, reading documents, and a busy model. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { handleAi } from "../../server/ai.ts";
import { sanitizePlan } from "../../server/prompts/plan.ts";
import { mergeAiProfile } from "../../src/lib/aiIntake.ts";
import { emptyProfile, parseDescription } from "../../src/lib/intake";
import { config, gemini, TODAY } from "./fixtures";

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

  test("are asked for with the profile and the draft, dated against the draft's event day", async () => {
    const notes = { summary: "A Kochi wedding in May.", tips: [], budget: [], timeline: [], vendors: [] };
    const { calls, fetchImpl } = gemini(notes);
    const body = { profile: { city: "Kochi" }, plan: { date: "2027-05-30", tasks: [] }, today: TODAY };
    const out = await handleAi("plan", body, config, fetchImpl);
    expect(out).toEqual({ status: 200, body: { ...notes, watchouts: [], ideas: [] } });
    const sent = JSON.stringify(calls[0]?.body);
    expect(sent).toContain(`between today (${TODAY}) and the event day (2027-05-30)`);
    expect(sent).toContain("Kochi");
    expect((await handleAi("plan", { plan: {} }, config, fetchImpl)).status).toBe(400);
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
    const sent = z
      .object({ systemInstruction: z.object({ parts: z.array(z.object({ text: z.string() })) }) })
      .parse(calls[0]?.body);
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
      inclusions: "Includes: vessels, serving staff and clearing",
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
      inclusions: "vessels, serving staff and clearing",
    });
    const sent = z
      .object({ contents: z.array(z.object({ parts: z.array(z.record(z.string(), z.unknown())) })) })
      .parse(calls[0]?.body);
    const parts = sent.contents[0]?.parts;
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
