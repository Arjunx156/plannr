/** The one-line history entries for plan changes, as the History tab and the Inbox show them. */
import { describe, expect, test } from "bun:test";
import { longDate } from "../src/lib/dates";
import { describePlanAction } from "../src/shared/describePlanAction";
import type { PlanAction } from "../src/shared/planActions";
import { demo } from "./support";

const { wedding, mela } = demo();
const w = wedding.id;

/** Each change, and the line it should read as against the demo wedding. */
const WEDDING_LINES: [PlanAction, string][] = [
  [
    { type: "addRecord", eventId: w, coll: "memory", record: { id: "m9", text: "Veg only at the haldi" } },
    "Plannr will remember “Veg only at the haldi”",
  ],
  [
    {
      type: "addRecord",
      eventId: w,
      coll: "announcements",
      record: { id: "n1", text: "Buses leave at 8", at: "" },
    },
    "Announced “Buses leave at 8”",
  ],
  [
    {
      type: "addRecord",
      eventId: w,
      coll: "households",
      record: { id: "h9", name: "Iyer family", side: "Rohan's family", expected: 4, functions: [], rsvp: {} },
    },
    "Added the household “Iyer family” (4)",
  ],
  [
    {
      type: "addRecord",
      eventId: w,
      coll: "payments",
      record: { id: "p9", date: "2026-11-01", label: "Florist advance", amount: 15000, paid: false },
    },
    "Scheduled ₹15,000: “Florist advance”",
  ],
  [
    { type: "updateRecord", eventId: w, coll: "vendors", id: "decor", patch: { stage: "quoted" } },
    "Moved Mangalya Décor (Décor) to quoted",
  ],
  [
    { type: "updateRecord", eventId: w, coll: "categories", id: "catering", patch: { planned: 500000 } },
    "Set the budget line “Catering” to ₹5,00,000",
  ],
  [
    { type: "updateRecord", eventId: w, coll: "categories", id: "catering", patch: { name: "Food" } },
    "Updated the budget line “Catering”",
  ],
  [
    { type: "removeRecord", eventId: w, coll: "memory", id: "m1" },
    "Removed the note “No alcohol at any function”",
  ],
  [{ type: "removeRecord", eventId: w, coll: "memory", id: "gone" }, "Removed an item"],
  [
    { type: "markPaid", eventId: w, paymentId: "p2", paid: false },
    "Marked “Catering advance · Sree Annapoorna” as not paid",
  ],
  [{ type: "markPaid", eventId: w, paymentId: "gone", paid: true }, "Changed a payment"],
  [
    { type: "checkIn", eventId: w, coll: "households", id: "h1", fnId: "ceremony", count: 5 },
    "Checked in Menon family, Tripunithura (5)",
  ],
  [
    { type: "checkIn", eventId: w, coll: "households", id: "gone", fnId: "ceremony", count: 1 },
    "Checked in a guest (1)",
  ],
  [
    { type: "shiftRunsheet", eventId: w, fnId: "mehendi", fromId: "rm2", minutes: 30 },
    "Moved the Mehendi run sheet 30 min later from “Bride's mehendi begins”",
  ],
  [
    { type: "shiftRunsheet", eventId: w, fnId: "nowhere", fromId: "gone", minutes: -15 },
    "Moved the day run sheet 15 min earlier from “an item”",
  ],
  [{ type: "setHeadcount", eventId: w, guests: 300 }, "Planned for 300 guests (was 268)"],
  [{ type: "bookVendor", eventId: w, vendorId: "decor" }, "Booked Mangalya Décor for Décor"],
  [{ type: "bookVendor", eventId: w, vendorId: "gone" }, "Booked a vendor"],
  [{ type: "updateEvent", eventId: w, patch: { name: "A & R" } }, "Renamed the event to “A & R”"],
  [{ type: "updateEvent", eventId: w, patch: { listMeta: "x" } }, "Updated the event"],
];

describe("history lines for a family's plan", () => {
  test.each(WEDDING_LINES)("%o reads as %p", (action, line) => {
    expect(describePlanAction(action, wedding)).toBe(line);
  });

  test("a date change names the new date in words", () => {
    expect(
      describePlanAction({ type: "updateEvent", eventId: w, patch: { date: "2027-01-15" } }, wedding),
    ).toBe(`Moved the event to ${longDate("2027-01-15")}`);
    expect(
      describePlanAction(
        { type: "updateRecord", eventId: w, coll: "functions", id: "haldi", patch: { date: "2027-01-14" } },
        wedding,
      ),
    ).toBe(`Moved the Haldi to ${longDate("2027-01-14")}`);
  });

  test("the event website's lines say whether it went up or came down", () => {
    const site = { ...wedding.site, published: true };
    expect(describePlanAction({ type: "updateEvent", eventId: w, patch: { site } }, wedding)).toBe(
      "Published the event website",
    );
    expect(
      describePlanAction(
        { type: "updateEvent", eventId: w, patch: { site: { ...site, published: false } } },
        wedding,
      ),
    ).toBe("Took the event website down");
  });

  test("an RSVP says who is coming to what, and what they'll miss", () => {
    const rsvp = (answers: Record<string, { status: "yes" | "no"; count: number }>) =>
      describePlanAction({ type: "rsvp", eventId: w, householdId: "h1", answers }, wedding);
    expect(rsvp({ haldi: { status: "yes", count: 4 }, reception: { status: "no", count: 0 } })).toBe(
      "Menon family, Tripunithura replied: 4 coming to Haldi, not Reception",
    );
    expect(rsvp({ reception: { status: "no", count: 0 } })).toBe(
      "Menon family, Tripunithura can't come to Reception",
    );
    expect(
      rsvp(
        Object.fromEntries(
          ["mehendi", "haldi", "ceremony", "reception"].map((f) => [f, { status: "no", count: 0 }]),
        ),
      ),
    ).toBe("Menon family, Tripunithura can't come");
  });
});

describe("history lines for a committee's plan", () => {
  const m = mela.id;

  test("approvals say which way they went", () => {
    const approve = (status: string) =>
      describePlanAction(
        { type: "updateRecord", eventId: m, coll: "approvals", id: "a1", patch: { status } },
        mela,
      );
    expect(approve("approved")).toBe("Approved the expense “Sound & lighting advance · Lumen Events”");
    expect(approve("declined")).toBe("Declined the expense “Sound & lighting advance · Lumen Events”");
  });

  test("volunteer changes name the role, the slot and the person", () => {
    const shifts = (a: Omit<Extract<PlanAction, { type: "editShifts" }>, "type" | "eventId">) =>
      describePlanAction({ type: "editShifts", eventId: m, ...a }, mela);
    expect(shifts({ op: "addVolunteer", name: "Neha" })).toBe("Added Neha to the volunteers");
    expect(shifts({ op: "addRole", role: "First aid" })).toBe("Added the volunteer role “First aid”");
    expect(shifts({ op: "setNeed", role: "Entry & passes", slot: 0, need: 4 })).toBe(
      "Set Entry & passes, 2–5 pm · setup to need 4",
    );
    expect(shifts({ op: "unassign", role: "Entry & passes", slot: 1, name: "Anu" })).toBe(
      "Took Anu off Entry & passes, 5–8 pm · stalls",
    );
  });

  test("a headcount change leaves out the old number when there isn't one", () => {
    expect(describePlanAction({ type: "setHeadcount", eventId: m, guests: 900 }, mela)).toBe(
      "Planned for 900 guests",
    );
  });
});
