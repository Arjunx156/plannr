/** Records: the generic collection operations, RSVPs and every collection's rules. */
import { describe, expect, test } from "bun:test";
import { duplicateGroups, functionCount, householdState, rsvpSummary } from "../src/shared/derive";
import { applyEventAction } from "../src/shared/engine";
import { functionsOf, vendorsOf } from "../src/shared/eventLists";
import { COLLS, canHold, findRecord, isColl, list, recordName, remove, setList } from "../src/shared/records";
import { demo, personal, present } from "./support";

const { wedding, birthday, mela, empty: anniversary } = demo();

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
    const vendors = vendorsOf(personal(old));
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
    expect(updated?.rsvp["ceremony"]).toEqual({ status: "yes", count: h.expected + 2 });
    expect(updated?.rsvp["reception"]).toEqual({ status: "no", count: 0 });
    expect(updated?.rsvp["mehendi"]).toBeUndefined();
    expect(updated?.meal).toBe("veg");
    expect(householdState(present(updated))).toBe("coming");
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

describe("every collection", () => {
  const events = { wedding, birthday, mela, anniversary };
  const cases = COLLS.flatMap((coll) =>
    Object.entries(events).map(([name, ev]) => ({ coll, name, ev, holds: canHold(ev, coll) })),
  );

  test.each(cases.filter((c) => !c.holds))(
    "$coll is empty on the $name, and can't be written",
    ({ coll, ev }) => {
      expect(list(ev, coll)).toEqual([]);
      expect(setList(ev, coll, [])).toBe(ev);
    },
  );

  test.each(cases.filter((c) => c.holds))(
    "$coll round-trips through its store on the $name",
    ({ coll, ev }) => {
      const items = list(ev, coll);
      // Writing back what was read changes nothing that matters.
      expect(list(setList(ev, coll, items), coll)).toEqual(items);
      expect(remove(ev, coll, "missing")).toBe(ev);
    },
  );

  const withRecords = cases.filter((c) => c.holds && list(c.ev, c.coll).length > 0);
  test.each(withRecords)("$coll on the $name is named in history and can lose a record", ({ coll, ev }) => {
    const items = list(ev, coll);
    const [first] = items;
    if (!first) throw new Error("filtered to collections with records");
    expect(recordName(coll, first).length).toBeGreaterThan(4);
    // A one-day event's day is worked out from its date, so it can't be removed.
    const derived = coll === "functions" && items.length === 1 && first.id === "day";
    expect(list(remove(ev, coll, first.id), coll)).toHaveLength(derived ? 1 : items.length - 1);
  });

  test("a missing record has a name, and only real collections are recognised", () => {
    expect(recordName("households", undefined)).toBe("an item");
    expect(isColl("households")).toBe(true);
    expect(isColl("users")).toBe(false);
  });
});
