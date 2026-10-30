import { describe, expect, test } from "bun:test";
import {
  clamp,
  initials,
  inr,
  inrShort,
  inrSigned,
  parseAmount,
  pct,
  plural,
  slug,
  timeAgo,
} from "../src/lib/format";

describe("rupees", () => {
  test("group in lakhs and crores, with a true minus sign", () => {
    expect(inr(1800000)).toBe("₹18,00,000");
    expect(inr(12345678)).toBe("₹1,23,45,678");
    expect(inr(-4500)).toBe("−₹4,500");
    expect(inr(999.6)).toBe("₹1,000");
  });

  test("a signed figure says which way it moved", () => {
    expect(inrSigned(36288)).toBe("+₹36,288");
    expect(inrSigned(-60480)).toBe("−₹60,480");
    expect(inrSigned(0)).toBe("₹0");
  });

  test("short figures use lakhs above one lakh and drop trailing zeros", () => {
    expect(inrShort(85000)).toBe("₹85,000");
    expect(inrShort(685000)).toBe("₹6.85L");
    expect(inrShort(1800000)).toBe("₹18L");
    expect(inrShort(250000)).toBe("₹2.5L");
    expect(inrShort(-1250000)).toBe("−₹12.5L");
  });
});

describe("amounts as families write them", () => {
  test.each([
    ["2,40,000", 240000],
    ["₹ 2,40,000", 240000],
    ["Rs. 85000", 85000],
    ["2.4L", 240000],
    ["2.4 lakh", 240000],
    ["18 lakhs", 1800000],
    ["85k", 85000],
    ["3 thousand", 3000],
    ["1.2 cr", 12000000],
    ["2 crore", 20000000],
    ["INR 500", 500],
  ])("%s is %d rupees", (text, rupees) => {
    expect(parseAmount(text)).toBe(rupees);
  });

  test.each(["", "about ten", "12 apples", "₹", "-"])("%p isn't an amount", (text) => {
    expect(parseAmount(text)).toBe(0);
  });
});

describe("small helpers", () => {
  test("percent of a whole, safe with an empty whole", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(5, 0)).toBe(0);
  });

  test("clamp keeps a value in range", () => {
    expect(clamp(1.4)).toBe(1);
    expect(clamp(-2)).toBe(0);
    expect(clamp(7, 0, 10)).toBe(7);
  });

  test("plural counts things in words", () => {
    expect(plural(1, "task")).toBe("1 task");
    expect(plural(3, "task")).toBe("3 tasks");
    expect(plural(2, "family", "families")).toBe("2 families");
  });

  test("initials come from the first and last names", () => {
    expect(initials("Priya Menon")).toBe("PM");
    expect(initials("Ananya, Rohan")).toBe("AR");
    expect(initials("Aarav")).toBe("AA");
    expect(initials("  ")).toBe("");
  });

  test("slugs are lower-case, hyphenated and short", () => {
    expect(slug("Ananya & Rohan's Wedding")).toBe("ananya-rohans-wedding");
    expect(slug("Café  Décor")).toBe("cafe-decor");
    expect(slug("x".repeat(80))).toHaveLength(48);
  });

  test("time ago reads naturally, then falls back to a date", () => {
    const now = Date.parse("2026-09-27T12:00:00Z");
    const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
    expect(timeAgo(ago(10), now)).toBe("just now");
    expect(timeAgo(ago(5 * 60), now)).toBe("5 min ago");
    expect(timeAgo(ago(3 * 3600), now)).toBe("3 h ago");
    expect(timeAgo(ago(30 * 3600), now)).toBe("yesterday");
    expect(timeAgo(ago(4 * 86400), now)).toBe("4 days ago");
    expect(timeAgo(ago(20 * 86400), now)).toBe("7 Sept");
    // A clock that's slightly ahead never says "in the future".
    expect(timeAgo(ago(-30), now)).toBe("just now");
  });
});
