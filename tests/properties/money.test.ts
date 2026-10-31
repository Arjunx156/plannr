/** Properties of the money that families split: shares add up, and settling up evens everyone out. */
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import type { FamilySplit } from "../../src/data/budgetTypes";
import { inr, parseAmount } from "../../src/lib/format";
import { settleUp, splitBalances } from "../../src/shared/balances";
import { demo } from "../support";

const { wedding } = demo();

/** Two to four sides, shares that add up to one, and what each has paid so far. */
const split: fc.Arbitrary<FamilySplit> = fc
  .array(
    fc.record({ weight: fc.integer({ min: 1, max: 10 }), paid: fc.integer({ min: 0, max: 5_000_000 }) }),
    {
      minLength: 2,
      maxLength: 4,
    },
  )
  .map((sides) => {
    const total = sides.reduce((s, x) => s + x.weight, 0);
    return {
      label: "Between the families",
      sides: sides.map((s, i) => ({
        name: `Side ${i + 1}`,
        share: s.weight / total,
        paid: s.paid,
        color: "#6E1F2E",
      })),
    };
  });

const withSplit = (s: FamilySplit) => ({ ...wedding, budget: { ...wedding.budget, split: s } });

describe("a family split, for any shares and payments", () => {
  test("each side's fair share adds up to what's been paid, give or take a rupee a side", () => {
    fc.assert(
      fc.property(split, (s) => {
        const balances = splitBalances(withSplit(s));
        const paid = s.sides.reduce((sum, x) => sum + x.paid, 0);
        const fair = balances.reduce((sum, b) => sum + b.fair, 0);
        expect(Math.abs(fair - paid)).toBeLessThanOrEqual(s.sides.length);
      }),
    );
  });

  test("settling up leaves every side within a few rupees of even", () => {
    fc.assert(
      fc.property(split, (s) => {
        const balances = splitBalances(withSplit(s));
        const after = new Map(balances.map((b) => [b.name, b.balance]));
        for (const t of settleUp(balances)) {
          after.set(t.from, (after.get(t.from) ?? 0) + t.amount);
          after.set(t.to, (after.get(t.to) ?? 0) - t.amount);
        }
        for (const left of after.values()) expect(Math.abs(left)).toBeLessThanOrEqual(s.sides.length);
      }),
    );
  });

  test("settling up only ever moves money from a side that owes to a side that's owed", () => {
    fc.assert(
      fc.property(split, (s) => {
        const balances = splitBalances(withSplit(s));
        const owed = new Map(balances.map((b) => [b.name, b.balance]));
        for (const t of settleUp(balances)) {
          expect(t.amount).toBeGreaterThan(0);
          expect(owed.get(t.from) ?? 0).toBeLessThan(0);
          expect(owed.get(t.to) ?? 0).toBeGreaterThan(0);
        }
      }),
    );
  });
});

describe("amounts as families write them", () => {
  test("any amount Plannr prints reads back as the same number", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000_000 }), (n) => {
        expect(parseAmount(inr(n))).toBe(n);
      }),
    );
  });

  test("lakhs and thousands read as the rupees they stand for", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999 }), (n) => {
        expect(parseAmount(`${n} lakh`)).toBe(n * 100_000);
        expect(parseAmount(`${n}k`)).toBe(n * 1000);
      }),
    );
  });

  test("text that isn't an amount reads as nothing, never as a wrong number", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/\d/.test(s)),
        (s) => {
          expect(parseAmount(s)).toBe(0);
        },
      ),
    );
  });
});
