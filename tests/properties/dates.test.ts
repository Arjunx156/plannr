/** Properties of dates: moving them is reversible, and every way Plannr prints one works for any day. */
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  addDays,
  dateRange,
  dayLine,
  daysBetween,
  fullDate,
  isIsoDate,
  longDate,
  shortDate,
  toISO,
} from "../../src/lib/dates";
import { shiftDates } from "../../src/shared/templates";
import { demo } from "../support";

/** Any calendar day from 2000 to 2099, as YYYY-MM-DD. */
const day: fc.Arbitrary<string> = fc
  .date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true })
  .map(toISO);
const shift = fc.integer({ min: -3650, max: 3650 });

describe("dates, for any day and any shift", () => {
  test("moving a date and moving it back gives the same date", () => {
    fc.assert(
      fc.property(day, shift, (d, n) => {
        expect(addDays(addDays(d, n), -n)).toBe(d);
      }),
    );
  });

  test("the days between a date and the date moved by n is n, across months, years and leap days", () => {
    fc.assert(
      fc.property(day, shift, (d, n) => {
        expect(daysBetween(d, addDays(d, n))).toBe(n);
      }),
    );
  });

  test("a moved date is still a real calendar date", () => {
    fc.assert(
      fc.property(day, shift, (d, n) => {
        expect(isIsoDate(addDays(d, n))).toBe(true);
      }),
    );
  });

  test("every way of printing a date works, for any day", () => {
    fc.assert(
      fc.property(day, day, (a, b) => {
        for (const text of [longDate(a), shortDate(a), fullDate(a), dayLine(a, "Kochi"), dateRange(a, b)])
          expect(text.length).toBeGreaterThan(0);
      }),
    );
  });

  test("moving a whole plan's dates and moving them back gives the same plan", () => {
    const { wedding } = demo();
    fc.assert(
      fc.property(shift, (n) => {
        expect(shiftDates(shiftDates(wedding, n), -n)).toEqual(wedding);
      }),
      { numRuns: 50 },
    );
  });
});
