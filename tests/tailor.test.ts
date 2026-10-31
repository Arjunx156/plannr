import { describe, expect, test } from "bun:test";
import { sanitizePlan } from "../server/prompts/plan";
import { STORY_DAY } from "../src/lib/dates";
import { emptyProfile, parseDescription } from "../src/lib/intake";
import { eventFromDraft } from "../src/lib/newEvent";
import { draftPlan } from "../src/lib/plan";
import { geminiBudget, geminiTimeline, geminiVendors, type PlanNotes, tailorPlan } from "../src/lib/tailor";

const profile = parseDescription(
  "Kerala wedding in Thrissur, 300 guests, ₹20 lakh, 17 January 2027. Food matters most.",
  emptyProfile(),
);
const base = draftPlan(profile);
const sum = (lines: { amount: number }[]) => lines.reduce((s, l) => s + l.amount, 0);

const notes: PlanNotes = {
  summary: "A sadhya-first wedding for 300 in Thrissur.",
  tips: [],
  watchouts: [],
  ideas: [],
  budget: [
    { name: "Contingency", percent: 6, why: "January is peak season; prices move." },
    { name: "Sadhya catering", percent: 34, why: "Food is the family's first priority." },
    { name: "Venue", percent: 18, why: "Thrissur halls for 300 run about this." },
    { name: "Décor", percent: 12, why: "Kasavu and jasmine, kept simple." },
    { name: "Attire & jewellery", percent: 15, why: "Gold is the bride's family's call." },
    { name: "Photography & video", percent: 10, why: "One team for both days." },
    { name: "Chenda melam", percent: 5, why: "The procession needs it." },
  ],
  timeline: [
    { title: "Book the hall", due: "2026-10-04", why: "January halls go a season ahead." },
    { title: "Book the sadhya caterer", due: "2026-10-11", why: "The best ones book early." },
    { title: "Back-dated by the model", due: "2026-01-01", why: "" },
    { title: "Share the run sheet", due: "2027-01-10", why: "A week out." },
    { title: "Beyond the day", due: "2027-03-01", why: "" },
  ],
  vendors: [
    { name: "Sadhya caterer", why: "Food first." },
    { name: "Venue", why: "Sets the date." },
    { name: "venue", why: "A repeat in another case." },
    { name: "Chenda melam", why: "For the procession." },
  ],
};

describe("Gemini's budget split", () => {
  test("adds up to the total exactly, largest first, contingency last", () => {
    const lines = geminiBudget(2000000, notes.budget ?? []);
    expect(lines).toBeDefined();
    expect(sum(lines ?? [])).toBe(2000000);
    expect(lines?.[0]?.name).toBe("Sadhya catering");
    expect(lines?.at(-1)?.name).toBe("Contingency");
    expect(lines?.[0]?.why).toBe("Food is the family's first priority.");
  });

  test("odd totals still add up exactly", () => {
    for (const total of [37000, 412345, 2500000])
      expect(sum(geminiBudget(total, notes.budget ?? []) ?? [])).toBe(total);
  });

  test("refuses percentages that don't add up to about 100", () => {
    const doubled = (notes.budget ?? []).map((l) => ({ ...l, percent: l.percent * 2 }));
    expect(geminiBudget(2000000, doubled)).toBeUndefined();
  });

  test("refuses a split with too few lines once repeats are removed", () => {
    expect(
      geminiBudget(100000, [
        { name: "Food", percent: 50, why: "" },
        { name: "food", percent: 30, why: "" },
        { name: "Venue", percent: 20, why: "" },
      ]),
    ).toBeUndefined();
  });

  test("refuses a split where a line rounds to nothing", () => {
    const tiny = [
      { name: "Food", percent: 60, why: "" },
      { name: "Venue", percent: 39, why: "" },
      { name: "Stickers", percent: 1, why: "" },
    ];
    expect(geminiBudget(20000, tiny)).toBeUndefined();
  });
});

describe("Gemini's timeline", () => {
  test("keeps every date between today and the day, in order", () => {
    const tasks = geminiTimeline(notes.timeline ?? [], STORY_DAY, "2027-01-17") ?? [];
    expect(tasks.map((t) => t.due)).toEqual([
      STORY_DAY,
      "2026-10-04",
      "2026-10-11",
      "2027-01-10",
      "2027-01-17",
    ]);
    expect(tasks[1]?.why).toBe("January halls go a season ahead.");
    expect(tasks[0]).not.toHaveProperty("why");
  });

  test("falls back when fewer than three tasks survive", () => {
    expect(
      geminiTimeline([{ title: "One", due: "2026-10-01", why: "" }], STORY_DAY, "2027-01-17"),
    ).toBeUndefined();
  });
});

describe("Gemini's vendors", () => {
  test("drops repeats regardless of case", () => {
    expect(geminiVendors(notes.vendors ?? [])?.map((v) => v.name)).toEqual([
      "Sadhya caterer",
      "Venue",
      "Chenda melam",
    ]);
  });
});

describe("tailoring a draft", () => {
  test("uses each part Gemini got right and says so", () => {
    const plan = tailorPlan(base, notes, STORY_DAY);
    expect(plan.byGemini).toEqual({ budget: true, timeline: true, vendors: true });
    expect(plan.budget.total).toBe(base.budget.total);
    expect(sum(plan.budget.lines)).toBe(base.budget.total);
  });

  test("falls back part by part", () => {
    const plan = tailorPlan(base, { ...notes, vendors: [], budget: [] }, STORY_DAY);
    expect(plan.byGemini).toEqual({ budget: false, timeline: true, vendors: false });
    expect(plan.budget).toEqual(base.budget);
    expect(plan.vendors).toEqual(base.vendors);
  });

  test("with no answer from Gemini, the standard draft stands", () => {
    expect(tailorPlan(base, undefined)).toBe(base);
    expect(base.byGemini).toEqual({ budget: false, timeline: false, vendors: false });
  });

  test("notes saved before Gemini drafted the lists still work", () => {
    const { budget: _b, timeline: _t, vendors: _v, ...old } = notes;
    expect(tailorPlan(base, old, STORY_DAY).byGemini).toEqual({
      budget: false,
      timeline: false,
      vendors: false,
    });
  });

  test("the accepted event carries Gemini's lines, dates and reasons", () => {
    const plan = tailorPlan(base, notes, STORY_DAY);
    const ev = eventFromDraft(profile, plan, { name: "Lakshmi", initials: "L" });
    expect(ev.budget.source).toStartWith("Split drafted by Gemini for this event.");
    expect(ev.budget.categories.map((c) => c.planned).reduce((a, b) => a + b, 0)).toBe(2000000);
    const catering = ev.budget.categories.find((c) => c.name === "Sadhya catering");
    expect(catering?.note).toBe("Food is the family's first priority.");
    // The what-if slider prices headcount from the food line, wherever the split put it.
    expect(ev.budget.whatIf?.rates[0]?.category).toBe("Sadhya catering");
    expect(ev.tasks.list.find((t) => t.title === "Book the hall")).toMatchObject({
      due: "2026-10-04",
      note: "January halls go a season ahead.",
    });
    expect(ev.vendors.needed).toEqual(["Sadhya caterer", "Venue", "Chenda melam"]);
  });
});

describe("budget line ids", () => {
  test("names in any script, or that slug alike, still get distinct ids", () => {
    const plan = tailorPlan(
      base,
      {
        ...notes,
        budget: [
          { name: "ഭക്ഷണം", percent: 40, why: "" },
          { name: "വേദി", percent: 30, why: "" },
          { name: "Décor", percent: 20, why: "" },
          { name: "Decor!", percent: 10, why: "" },
        ],
      },
      STORY_DAY,
    );
    const ids = eventFromDraft(profile, plan, { name: "L", initials: "L" }).budget.categories.map(
      (c) => c.id,
    );
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });
});

describe("the standard draft", () => {
  test("its timeline runs from the first weeks to the week of the day, in date order", () => {
    const dues = base.timeline.map((t) => t.due);
    expect(dues).toEqual([...dues].sort());
    expect(dues[0]).toBe("2026-10-04");
    expect(base.timeline.at(-1)).toEqual({
      title: "Share the run sheet and pay the balances",
      due: "2027-01-10",
    });
  });
});

describe("the plan route's sanitizer", () => {
  test("keeps well-formed rows and drops the rest", () => {
    const s = sanitizePlan({
      summary: "Fine.",
      tips: [],
      budget: [
        { name: "Food", percent: 40, why: "Most of it." },
        { name: "", percent: 10 },
        { name: "Venue", percent: "thirty" },
        { name: "Venue", percent: 30 },
      ],
      timeline: [
        { title: "Book it", due: "2026-10-01", why: "Soon." },
        { title: "Bad date", due: "2026-02-30" },
      ],
      vendors: [{ name: "Caterer" }, { why: "no name" }],
    });
    expect(s.budget).toEqual([
      { name: "Food", percent: 40, why: "Most of it." },
      { name: "Venue", percent: 30, why: "" },
    ]);
    expect(s.timeline).toEqual([{ title: "Book it", due: "2026-10-01", why: "Soon." }]);
    expect(s.vendors).toEqual([{ name: "Caterer", why: "" }]);
  });

  test("an answer without the lists still sanitizes to empty ones", () => {
    const s = sanitizePlan({ summary: "Fine.", tips: [] });
    expect([s.budget, s.timeline, s.vendors]).toEqual([[], [], []]);
  });
});
