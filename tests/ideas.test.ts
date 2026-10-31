import { describe, expect, test } from "bun:test";
import { handleAi } from "../server/ai.ts";
import { ideasRequest, sanitizeIdeas } from "../server/prompts/ideas.ts";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent } from "../src/data/types";
import { toCsv } from "../src/lib/csv";
import { deviceIdeas, ideaBrief, ideaRecord } from "../src/lib/ideas";
import { list } from "../src/shared/records";

const config = { apiKey: "test-key", model: "test-model" };
const wedding = seedEvents().find((e) => e.id === "ananya-rohan") as PersonalEvent;

const idea = (over: Record<string, unknown> = {}) => ({
  title: "Kasavu runners on every table",
  detail: "Cream and gold runners tie the reception to the ceremony.",
  because: "A Kerala wedding in Kochi",
  effort: "low",
  cost: 12000,
  category: "Décor",
  ...over,
});

function gemini(payload: unknown) {
  const sent: string[] = [];
  const fetchImpl = async (_url: string, init: RequestInit) => {
    sent.push(String(init.body));
    const body = { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { sent, fetchImpl };
}

describe("ideas route", () => {
  test("asks Gemini with the brief and returns sanitized ideas", async () => {
    const { sent, fetchImpl } = gemini({ ideas: [idea(), idea({ title: "  " })] });
    const out = await handleAi(
      "ideas",
      { brief: ideaBrief(wedding), avoid: [], today: "2026-09-27" },
      config,
      fetchImpl,
    );
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ideas: [idea()] });
    const request = JSON.parse(sent[0] ?? "{}");
    expect(request.generationConfig.responseJsonSchema.required).toEqual(["ideas"]);
    expect(JSON.stringify(request.contents)).toContain(wedding.name);
  });

  test("rejects a request with no brief", async () => {
    const out = await handleAi("ideas", { avoid: [] }, config, gemini({}).fetchImpl);
    expect(out.status).toBe(400);
  });

  test("fails when the model has nothing usable, so the app falls back", async () => {
    const out = await handleAi("ideas", { brief: {} }, config, gemini({ ideas: [{ title: "x" }] }).fetchImpl);
    expect(out.status).toBe(502);
  });
});

describe("sanitizing ideas", () => {
  test("drops ideas the board has, repeats and incomplete ones, and caps the list", () => {
    const raw = {
      ideas: [
        idea({ title: "Already there" }),
        idea(),
        idea({ title: "KASAVU RUNNERS ON EVERY TABLE" }),
        idea({ title: "No reason", because: "" }),
        ...Array.from({ length: 8 }, (_, n) => idea({ title: `Idea ${n}` })),
      ],
    };
    const { ideas } = sanitizeIdeas(raw, ["already there"]);
    expect(ideas.length).toBe(6);
    expect(ideas[0]?.title).toBe("Kasavu runners on every table");
    expect(ideas.some((i) => i.title === "No reason")).toBe(false);
  });

  test("keeps effort to the known levels and drops nonsense costs", () => {
    const { ideas } = sanitizeIdeas({ ideas: [idea({ effort: "huge", cost: -5 })] });
    expect(ideas[0]?.effort).toBe("medium");
    expect(ideas[0]?.cost).toBeUndefined();
  });

  test("clips what the board sends to avoid", () => {
    const r = ideasRequest({ brief: {}, avoid: Array.from({ length: 60 }, (_, n) => `Idea ${n}`) });
    expect(r.avoid.length).toBe(40);
  });
});

describe("the ideas brief", () => {
  test("carries guests as counts, never a name or a phone number", () => {
    const brief = JSON.stringify(ideaBrief(wedding));
    const households = list(wedding, "households");
    expect(households.length).toBeGreaterThan(0);
    for (const h of households) {
      expect(brief).not.toContain(h.name);
      if (h.phone) expect(brief).not.toContain(h.phone);
    }
    expect(brief).toContain(`"guests":${wedding.guests}`);
  });
});

describe("ideas on the device", () => {
  test("each explains itself and skips what the board already has", () => {
    const ideas = deviceIdeas(wedding);
    expect(ideas.length).toBeGreaterThan(2);
    for (const i of ideas) expect(i.because.length).toBeGreaterThan(0);
    const first = ideas[0];
    if (!first) throw new Error("no ideas");
    const withIt = { ...wedding, ideas: [ideaRecord(first, [], "i1")] };
    expect(deviceIdeas(withIt).map((i) => i.title)).not.toContain(first.title);
  });

  test("a suggestion joins the budget line it names", () => {
    const lines = wedding.budget.categories;
    const line = lines[0];
    if (!line) throw new Error("no budget lines");
    const rec = ideaRecord(idea({ category: line.name.toUpperCase() }) as never, lines, "i9");
    expect(rec).toMatchObject({
      id: "i9",
      status: "idea",
      categoryId: line.id,
      because: "A Kerala wedding in Kochi",
    });
  });
});

describe("CSV export", () => {
  test("quotes cells and defuses formulas", () => {
    const csv = toCsv([
      ["From", "Gift"],
      ['=HYPERLINK("http://x")', "+91 cheque"],
      ["Menon family", 'Gold "coin"'],
    ]);
    expect(csv.split("\n")).toEqual([
      '"From","Gift"',
      '"\'=HYPERLINK(""http://x"")","\'+91 cheque"',
      '"Menon family","Gold ""coin"""',
    ]);
  });
});

describe("ideas from the family's own notes", () => {
  test("come first and quote the note they answer", () => {
    const ideas = deviceIdeas(wedding);
    expect(ideas[0]).toMatchObject({
      title: "A mocktail and fresh juice counter",
      because: "Your note: “No alcohol at any function”",
    });
    expect(ideas.some((i) => i.because.includes("wheelchair"))).toBe(true);
  });

  test("a birthday's allergy note and a mela's sound rule shape their ideas", () => {
    const [, birthday, mela] = seedEvents() as [PersonalEvent, PersonalEvent, CommunityEvent];
    expect(deviceIdeas(birthday)[0]?.title).toBe("Allergy labels on every dish");
    const melaIdeas = deviceIdeas(mela).map((i) => i.title);
    expect(melaIdeas).toContain("Steel plates and a washing station");
    expect(melaIdeas).toContain("Sound checks early, stage off on time");
  });
});
