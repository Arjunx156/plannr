import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../src/data/types";
import {
  duplicateGroups,
  functionCount,
  fundTotals,
  householdState,
  nowAndNext,
  rsvpSummary,
  runsheetFor,
  settleUp,
  splitBalances,
  vendorSummary,
} from "../src/shared/derive";
import { applyEventAction, describeAction, replay, stamp } from "../src/shared/engine";
import { addMinutes } from "../src/shared/planActions";
import { findRecord, functionsOf, list, vendorsOf } from "../src/shared/records";

const events = seedEvents();
const wedding = events.find((e) => e.id === "ananya-rohan") as PersonalEvent;
const birthday = events.find((e) => e.id === "aarav-6") as PersonalEvent;
const mela = events.find((e) => e.id === "green-valley-mela") as CommunityEvent;
const anniversary = events.find((e) => e.layout === "empty") as PlannrEvent;

describe("records", () => {
  test("adding, changing and removing a household", () => {
    const added = applyEventAction(wedding, {
      type: "addRecord",
      eventId: wedding.id,
      coll: "households",
      record: { id: "new", name: "Raman family", expected: 3, functions: ["reception"], rsvp: {} },
    });
    expect(findRecord(added, "households", "new")?.name).toBe("Raman family");
    const changed = applyEventAction(added, {
      type: "updateRecord",
      eventId: wedding.id,
      coll: "households",
      id: "new",
      patch: { expected: 4, id: "hijack" },
    });
    // The id never changes through an update.
    expect(findRecord(changed, "households", "new")?.expected).toBe(4);
    expect(findRecord(changed, "households", "hijack")).toBeUndefined();
    const removed = applyEventAction(changed, {
      type: "removeRecord",
      eventId: wedding.id,
      coll: "households",
      id: "new",
    });
    expect(findRecord(removed, "households", "new")).toBeUndefined();
  });

  test("lists a layout can't hold are left alone", () => {
    const after = applyEventAction(wedding, {
      type: "addRecord",
      eventId: wedding.id,
      coll: "stalls",
      record: { id: "s", name: "x", owner: "y", fee: 1, paid: false, status: "requested" },
    });
    expect(after).toEqual(wedding);
    expect(list(anniversary, "households")).toEqual([]);
  });

  test("older plans list vendors from their category names", () => {
    const { vendorList: _drop, ...old } = wedding;
    const vendors = vendorsOf(old as PersonalEvent);
    expect(vendors.map((v) => v.category)).toContain("Photography");
    expect(vendors.find((v) => v.category === "Venue")?.stage).toBe("booked");
  });

  test("events without functions have one day", () => {
    expect(functionsOf(birthday).map((f) => f.id)).toEqual(["day"]);
    expect(functionsOf(mela)[0]?.date).toBe(mela.date);
  });
});

describe("RSVPs", () => {
  test("a household answers for the functions it's invited to, capped at invited plus two", () => {
    const h = list(wedding, "households").find((x) => x.name === "Nair family, Thrissur");
    if (!h) throw new Error("seed has the Nair family");
    const after = applyEventAction(wedding, {
      type: "rsvp",
      eventId: wedding.id,
      householdId: h.id,
      answers: {
        ceremony: { status: "yes", count: 40 },
        reception: { status: "no", count: 3 },
        mehendi: { status: "yes", count: 2 },
      },
      meal: "veg",
      at: "2026-09-28T10:00:00.000Z",
    });
    const updated = findRecord(after, "households", h.id);
    expect(updated?.rsvp.ceremony).toEqual({ status: "yes", count: h.expected + 2 });
    expect(updated?.rsvp.reception).toEqual({ status: "no", count: 0 });
    expect(updated?.rsvp.mehendi).toBeUndefined();
    expect(updated?.meal).toBe("veg");
    expect(householdState(updated as NonNullable<typeof updated>)).toBe("coming");
  });

  test("RSVPs feed the guest summary and each function's count", () => {
    const summary = rsvpSummary(wedding);
    expect(summary.total).toBe(268);
    expect(summary.confirmed + summary.declined + summary.pending + summary.notSent).toBeLessThanOrEqual(268);
    const reception = functionCount(wedding, "reception");
    const invited = list(wedding, "households").filter((h) => h.functions.includes("reception"));
    expect(reception.invited).toBe(invited.reduce((s, h) => s + h.expected, 0));
    expect(reception.yes).toBeGreaterThan(0);
    expect(reception.yes).toBeLessThan(reception.invited);
  });

  test("the same family entered twice is caught", () => {
    const hs = [
      ...list(wedding, "households"),
      { id: "dup", name: "The Menon Family, Tripunithura", expected: 2, functions: [], rsvp: {} },
    ];
    const groups = duplicateGroups(hs);
    expect(groups.some((g) => g.some((h) => h.id === "dup"))).toBe(true);
  });
});

describe("money", () => {
  test("marking a payment paid updates its budget line and the family who paid, once", () => {
    const action = stamp(
      {
        type: "markPaid",
        eventId: wedding.id,
        paymentId: "p4",
        paid: true,
        by: "Rohan's family",
        method: "upi",
      },
      "2026-09-28",
    );
    expect(action.type === "markPaid" && action.on).toBe("2026-09-28");
    const venueBefore = findRecord(wedding, "categories", "venue")?.spent ?? 0;
    const once = applyEventAction(wedding, action);
    const twice = applyEventAction(once, action);
    expect(twice).toEqual(once);
    expect(findRecord(once, "categories", "venue")?.spent).toBe(venueBefore + 120000);
    const rohan = (once as PersonalEvent).budget.split?.sides.find((s) => s.name === "Rohan's family");
    expect(rohan?.paid).toBe(225000 + 120000);
    expect(describeAction(action, wedding)).toBe("Paid ₹1,20,000: “Venue balance · Suresh”");

    const undone = applyEventAction(once, {
      type: "markPaid",
      eventId: wedding.id,
      paymentId: "p4",
      paid: false,
    });
    expect(findRecord(undone, "categories", "venue")?.spent).toBe(venueBefore);
  });

  test("the split says who owes whom, and a settle-up evens it out", () => {
    const balances = splitBalances(wedding);
    const transfers = settleUp(balances);
    expect(transfers).toHaveLength(1);
    const t = transfers[0];
    if (!t) throw new Error("someone owes");
    const settled = applyEventAction(wedding, {
      type: "addRecord",
      eventId: wedding.id,
      coll: "settlements",
      record: { id: "s1", from: t.from, to: t.to, amount: t.amount, on: "2026-09-28" },
    }) as PersonalEvent;
    expect(settleUp(splitBalances(settled))).toEqual([]);
  });
});

describe("the day", () => {
  test("running late shifts what's left, not what's done", () => {
    const ceremony = runsheetFor(wedding, "ceremony");
    const from = ceremony.find((r) => r.title.startsWith("Bride's arrival"));
    if (!from) throw new Error("seed has the procession");
    const after = applyEventAction(wedding, {
      type: "shiftRunsheet",
      eventId: wedding.id,
      fnId: "ceremony",
      fromId: from.id,
      minutes: 8,
    });
    const shifted = runsheetFor(after, "ceremony");
    expect(shifted.find((r) => r.id === from.id)?.time).toBe("09:53");
    expect(shifted.find((r) => r.title.startsWith("Muhurtham"))?.time).toBe("10:50");
    expect(shifted.find((r) => r.title.startsWith("Venue opens"))?.time).toBe("06:30");
    expect(runsheetFor(after, "reception")[0]?.time).toBe("18:30");
    expect(addMinutes("23:55", 30)).toBe("23:59");
  });

  test("now and next follow the clock", () => {
    const items = runsheetFor(wedding, "ceremony");
    const { now, next } = nowAndNext(items, "10:00");
    expect(now?.title).toContain("procession");
    expect(next[0]?.title).toContain("Kanyadanam");
  });

  test("check-ins are saved but stay out of history", () => {
    const h = list(wedding, "households")[0];
    if (!h) throw new Error("seed has households");
    const after = applyEventAction(wedding, {
      type: "checkIn",
      eventId: wedding.id,
      coll: "households",
      id: h.id,
      fnId: "ceremony",
      count: 6,
    });
    expect(findRecord(after, "households", h.id)?.checkedIn?.ceremony).toBe(6);
  });
});

describe("community", () => {
  test("sponsorships and stall fees count towards funds", () => {
    const f = fundTotals(mela);
    expect(f.expected).toBe(150000 + 70000 + 45000);
    expect(f.received).toBe(150000 + 40000 + 30000);
    expect(f.stalls).toMatchObject({ booked: 18, paid: 12, requested: 2 });
    expect(f.passes.issued).toBeGreaterThan(50);
  });

  test("a stall paying its fee moves the fund total", () => {
    const after = applyEventAction(mela, {
      type: "updateRecord",
      eventId: mela.id,
      coll: "stalls",
      id: "st13",
      patch: { paid: true },
    }) as CommunityEvent;
    expect(fundTotals(after).received).toBe(fundTotals(mela).received + 2500);
  });

  test("permits and fund sources get ids so they can be edited", () => {
    const permits = list(mela, "permits");
    expect(permits[0]?.id).toBe("police-permission-sound");
    const after = applyEventAction(mela, {
      type: "updateRecord",
      eventId: mela.id,
      coll: "permits",
      id: "police-permission-sound",
      patch: { status: "Filed", tone: "due" },
    });
    expect(list(after, "permits")[0]?.status).toBe("Filed");
  });
});

describe("vendors", () => {
  test("booking moves a vendor to booked", () => {
    const after = applyEventAction(wedding, {
      type: "bookVendor",
      eventId: wedding.id,
      vendorId: "photography",
      quoteId: "ph-q2",
    });
    expect(findRecord(after, "vendors", "photography")).toMatchObject({
      stage: "booked",
      chosenQuote: "ph-q2",
    });
    expect(vendorSummary(after).booked).toContain("Photography");
  });

  test("everything replays to the same plan", () => {
    const actions = [
      { type: "setHeadcount", eventId: wedding.id, guests: 280 },
      { type: "updateEvent", eventId: wedding.id, patch: { site: { published: true } } },
      {
        type: "addRecord",
        eventId: wedding.id,
        coll: "memory",
        record: { id: "m9", text: "Vegetarian only" },
      },
    ] as const;
    const once = replay(wedding, [...actions]);
    expect(replay(wedding, [...actions])).toEqual(once);
    expect((once as PersonalEvent).guests).toBe(280);
    expect((once as PersonalEvent).site?.published).toBe(true);
    expect((once as PersonalEvent).site?.story).toBe(wedding.site?.story);
  });
});
