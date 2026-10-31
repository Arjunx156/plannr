/** The intake route: reading a family's description into a profile, and merging it in. */
import { describe, expect, test } from "bun:test";
import { handleAi } from "../../server/ai.ts";
import { aiConfig } from "../../server/gemini.ts";
import { sanitizeIntake } from "../../server/prompts/intake.ts";
import { mergeAiProfile } from "../../src/lib/aiIntake.ts";
import { emptyProfile, parseDescription } from "../../src/lib/intake";
import { config, gemini, TODAY } from "./fixtures";

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
    expect(calls[0]?.body).toMatchObject({
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: expect.anything() },
    });
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
