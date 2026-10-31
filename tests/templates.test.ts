import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../src/data/types";
import { addDays } from "../src/lib/dates";
import { list } from "../src/shared/records";
import { fromTemplate, shiftDates, toTemplate } from "../src/shared/templates";

const events = seedEvents();
const wedding = events.find((e) => e.id === "ananya-rohan") as PersonalEvent;
const mela = events.find((e) => e.id === "green-valley-mela") as CommunityEvent;
const blank = events.find((e) => e.layout === "empty") as PlannrEvent;

describe("shiftDates", () => {
  test("moves every ISO date, however deep, and nothing else", () => {
    const moved = shiftDates({ on: "2026-03-01", note: "2026 plans", list: [{ due: "2026-02-27" }] }, 2);
    expect(moved).toEqual({ on: "2026-03-03", note: "2026 plans", list: [{ due: "2026-03-01" }] });
  });

  test("a zero shift returns the same value", () => {
    const value = { on: "2026-03-01" };
    expect(shiftDates(value, 0)).toBe(value);
  });
});

describe("toTemplate", () => {
  test("a wedding keeps its shape and real costs, and clears what happened", () => {
    const t = toTemplate(wedding) as PersonalEvent;
    expect(t.tasks.list.length).toBe(wedding.tasks.list.length);
    expect(t.tasks.list.every((x) => !x.done)).toBe(true);
    expect(list(t, "households").every((h) => Object.keys(h.rsvp).length === 0 && !h.checkedIn)).toBe(true);
    expect(t.budget.payments).toEqual([]);
    expect(t.budget.committed).toBe(0);
    expect(t.assistant.thread).toEqual([]);
    expect(t.site?.published ?? false).toBe(false);
    for (const [i, c] of t.budget.categories.entries()) {
      const was = wedding.budget.categories[i];
      if (!was) throw new Error("category missing");
      // What it really cost becomes the plan.
      expect(c.planned).toBe(Math.max(was.spent, was.projected ?? was.planned));
      expect(c.spent).toBe(0);
    }
  });

  test("last time's vendors become a shortlist with their old prices", () => {
    const vendors = list(toTemplate(wedding), "vendors");
    expect(vendors.every((v) => v.stage === (v.name ? "enquired" : "needed") && !v.chosenQuote)).toBe(true);
    const labels = vendors.flatMap((v) => v.quotes.map((q) => q.label));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => l.startsWith("Last time: "))).toBe(true);
    // Saving a template of a template doesn't stack the prefix.
    const again = list(toTemplate(toTemplate(wedding)), "vendors").flatMap((v) =>
      v.quotes.map((q) => q.label),
    );
    expect(again).toEqual(labels);
  });

  test("a mela starts its money, passes and shifts over", () => {
    const t = toTemplate(mela) as CommunityEvent;
    expect(t.funds.sources.every((s) => s.received === 0)).toBe(true);
    expect(t.funds.approvals).toEqual([]);
    expect(list(t, "passes")).toEqual([]);
    expect(list(t, "stalls").every((s) => !s.paid && s.status === "requested")).toBe(true);
    expect(t.shifts.roles.flatMap((r) => r.slots.flatMap((s) => s.names))).toEqual([]);
    expect(t.shifts.roles.length).toBe(mela.shifts.roles.length);
  });

  test("leaves the original alone, and a blank event as it is", () => {
    const before = structuredClone(wedding);
    toTemplate(wedding);
    expect(wedding).toEqual(before);
    expect(toTemplate(blank)).toEqual(blank);
  });
});

describe("fromTemplate", () => {
  test("a new event on the new day, with every date moved by the same amount", () => {
    const date = addDays(mela.date, 364);
    const next = fromTemplate(toTemplate(mela), { id: "mela-next", name: "Mela next year", date });
    expect(next).toMatchObject({ id: "mela-next", name: "Mela next year", date });
    const was = (mela as CommunityEvent).tasks.list[0];
    const now = (next as CommunityEvent).tasks.list[0];
    if (!was || !now) throw new Error("no tasks");
    expect(now.due).toBe(addDays(was.due, 364));
  });
});
