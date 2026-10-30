import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent, Vendor } from "../src/data/types";
import { TODAY } from "../src/lib/dates";
import { buildTimeline, checklistProgress, vendorChecklist } from "../src/shared/planning";
import { linkExpiry } from "../src/shared/public";

const [wedding, birthday, mela] = seedEvents() as [PersonalEvent, PersonalEvent, CommunityEvent];

function withVendors<T extends PersonalEvent | CommunityEvent>(ev: T, vendorList: Vendor[]): T {
  return { ...ev, vendorList };
}

describe("vendor checklist", () => {
  test("lists what a wedding needs, ticks off booked vendors and dates each one back from the day", () => {
    const items = vendorChecklist(wedding, TODAY);
    const venue = items.find((i) => i.category === "Venue");
    expect(venue?.state).toBe("booked");
    expect(venue?.vendorName).toBe("Kayal Heritage Centre");
    const priest = items.find((i) => i.category === "Priest");
    expect(priest?.state).toBe("missing");
    expect(priest?.bookBy).toBe("2027-02-24");
    // Mehendi is one of this wedding's functions, so its artist is on the list.
    expect(items.some((i) => i.category === "Mehendi artist")).toBe(true);
  });

  test("puts what's still to book first, soonest deadline first", () => {
    const items = vendorChecklist(wedding, TODAY);
    const states = items.map((i) => i.state);
    expect(states.indexOf("booked")).toBeGreaterThan(states.lastIndexOf("missing"));
    const missing = items.filter((i) => i.state === "missing").map((i) => i.bookBy);
    expect(missing).toEqual([...missing].sort());
  });

  test("flags vendors past their book-by date, and only those not booked", () => {
    const items = vendorChecklist(birthday, TODAY);
    const late = items.filter((i) => i.late);
    expect(late.map((i) => i.category)).toEqual(["Entertainment"]);
    expect(late.every((i) => i.state !== "booked" && i.bookBy < TODAY)).toBe(true);
    expect(checklistProgress(items)).toEqual({ booked: 2, total: 7, late: 1 });
  });

  test("a birthday without mehendi isn't asked for a mehendi artist; a vendor the family added is kept", () => {
    const custom: Vendor = {
      id: "x",
      category: "Balloon artist",
      name: "Pop!",
      stage: "enquired",
      quotes: [],
    };
    const items = vendorChecklist(withVendors(birthday, [custom]), TODAY);
    expect(items.some((i) => i.category === "Mehendi artist")).toBe(false);
    // "balloon" matches the décor entry rather than becoming a separate line.
    expect(items.find((i) => i.category === "Décor")).toMatchObject({ state: "talking", vendorId: "x" });
  });

  test("keeps vendors the catalogue doesn't know as their own lines", () => {
    const custom: Vendor = { id: "y", category: "Fireworks", name: "", stage: "needed", quotes: [] };
    const items = vendorChecklist(withVendors(mela, [custom]), TODAY);
    expect(items.find((i) => i.category === "Fireworks")).toMatchObject({ state: "missing", vendorId: "y" });
  });

  test("the furthest-along vendor counts when several cover one item", () => {
    const two: Vendor[] = [
      { id: "a", category: "Catering", name: "A", stage: "enquired", quotes: [] },
      { id: "b", category: "Catering", name: "B", stage: "booked", quotes: [] },
    ];
    const item = vendorChecklist(withVendors(wedding, two), TODAY).find((i) => i.category === "Catering");
    expect(item).toMatchObject({ state: "booked", vendorId: "b" });
  });
});

describe("timeline", () => {
  test("puts every task, unpaid payment, booking and function in date order", () => {
    const phases = buildTimeline(wedding, TODAY);
    const entries = phases.flatMap((p) => p.entries);
    expect(entries.filter((e) => e.kind === "task")).toHaveLength(wedding.tasks.list.length);
    expect(entries.filter((e) => e.kind === "function").map((e) => e.title)).toEqual(
      wedding.functions.map((f) => f.label),
    );
    for (const p of phases) {
      const dates = p.entries.map((e) => e.date);
      expect(dates).toEqual([...dates].sort());
    }
  });

  test("doesn't repeat a payment or booking that a task already covers", () => {
    const entries = buildTimeline(wedding, TODAY).flatMap((p) => p.entries);
    expect(entries.some((e) => e.kind === "task" && e.title === "Pay venue balance ₹1,20,000")).toBe(true);
    expect(entries.some((e) => e.kind === "payment" && e.title.startsWith("Venue balance"))).toBe(false);
    expect(entries.some((e) => e.kind === "task" && e.title === "Book photographer")).toBe(true);
    expect(entries.some((e) => e.kind === "booking" && e.title === "Book photography")).toBe(false);
  });

  test("marks the phase today falls in and the entries that are late", () => {
    const phases = buildTimeline(birthday, TODAY);
    expect(phases.filter((p) => p.current).map((p) => p.id)).toEqual(["month"]);
    const late = phases.flatMap((p) => p.entries).filter((e) => e.late);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((e) => !e.done && e.date < TODAY && e.kind !== "function")).toBe(true);
  });

  test("every function of a multi-day wedding falls on 'the day'", () => {
    const day = buildTimeline(wedding, TODAY).find((p) => p.id === "day");
    expect(day?.entries.filter((e) => e.kind === "function")).toHaveLength(wedding.functions.length);
  });

  test("an event with no plan has no timeline", () => {
    const empty = seedEvents().find((e) => e.layout === "empty");
    expect(empty && buildTimeline(empty, TODAY)).toEqual([]);
  });
});

describe("shared link expiry", () => {
  test("counts from the last function, and keeps photos and the fund report open for longer", () => {
    // The wedding's last function is the reception on the event date.
    expect(linkExpiry(wedding, "rsvp")).toBe("2027-05-25");
    expect(linkExpiry(wedding, "album")).toBe("2027-10-22");
    expect(linkExpiry(mela, "fund")).toBe("2027-05-06");
  });
});
