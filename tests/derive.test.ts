/** Figures the screens derive from a plan: headcounts, quote totals, check-ins and the day's function. */
import { describe, expect, test } from "bun:test";
import { addDays } from "../src/lib/dates";
import { checkInCount, functionOn, quoteTotal, rsvpSummary } from "../src/shared/derive";
import { demo } from "./support";

const { wedding } = demo();

describe("derived figures", () => {
  test("without a guest list, the headcount is the plan's own figures", () => {
    const { households: _, ...noList } = wedding;
    expect(rsvpSummary(noList)).toEqual(wedding.rsvp);
  });

  test("a per-guest quote is multiplied by the headcount, and a flat one isn't", () => {
    expect(quoteTotal(950, true, 300)).toBe(285_000);
    expect(quoteTotal(950, false, 300)).toBe(950);
    expect(quoteTotal(950, undefined, 300)).toBe(950);
  });

  test("check-ins add up across households, against those expected", () => {
    const households = (wedding.households ?? []).map((h, i) =>
      i < 2 ? { ...h, checkedIn: { ceremony: 3 } } : h,
    );
    const count = checkInCount({ ...wedding, households }, "ceremony");
    expect(count.inside).toBe(6);
    expect(count.expected).toBeGreaterThan(0);
  });

  test("the function on a date, else the next one, else the last", () => {
    // The demo's dates move with today, so they're read from the plan rather than written here.
    const haldi = wedding.functions.find((f) => f.id === "haldi");
    if (!haldi) throw new Error("the demo wedding has a haldi");
    const last = wedding.functions.map((f) => f.date).sort()[wedding.functions.length - 1] ?? "";
    expect(functionOn(wedding, haldi.date)?.id).toBe("haldi");
    expect(functionOn(wedding, addDays(haldi.date, -1))?.id).toBe("haldi");
    expect(functionOn(wedding, addDays(last, 10))?.date).toBe(last);
  });
});
