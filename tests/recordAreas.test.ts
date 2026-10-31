/** Records by area: money, the day's schedule, the mela's committee and vendors. */
import { describe, expect, test } from "bun:test";
import { fundTotals, giftTotals, settleUp, splitBalances } from "../src/shared/balances";
import { nowAndNext, runsheetFor, vendorSummary } from "../src/shared/derive";
import { describeAction } from "../src/shared/describeAction";
import { applyEventAction, replay, stamp } from "../src/shared/engine";
import { addMinutes } from "../src/shared/planActions";
import { findRecord, list } from "../src/shared/records";
import { community, demo, personal } from "./support";

const { wedding, mela } = demo();

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
    const rohan = personal(once).budget.split?.sides.find((s) => s.name === "Rohan's family");
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
    const settled = personal(
      applyEventAction(wedding, {
        type: "addRecord",
        eventId: wedding.id,
        coll: "settlements",
        record: { id: "s1", from: t.from, to: t.to, amount: t.amount, on: "2026-09-28" },
      }),
    );
    expect(settleUp(splitBalances(settled))).toEqual([]);
  });

  test("gifts add up their cash and count the thank-yous still owed", () => {
    const gifts = [
      { id: "g1", from: "Menon family", amount: 5001, thanked: true },
      { id: "g2", from: "Nair family", item: "Silver lamp" },
      { id: "g3", from: "Varghese family", amount: 2001 },
    ];
    expect(giftTotals({ ...wedding, gifts })).toEqual({ count: 3, cash: 7002, toThank: 2 });
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
    expect(findRecord(after, "households", h.id)?.checkedIn?.["ceremony"]).toBe(6);
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
    const after = community(
      applyEventAction(mela, {
        type: "updateRecord",
        eventId: mela.id,
        coll: "stalls",
        id: "st13",
        patch: { paid: true },
      }),
    );
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
    expect(personal(once).guests).toBe(280);
    expect(personal(once).site?.published).toBe(true);
    expect(personal(once).site?.story).toBe(wedding.site?.story);
  });
});
