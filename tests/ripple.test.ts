import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../src/data/types";
import { introFor, reply } from "../src/lib/assistant";
import { budgetTotals } from "../src/lib/metrics";
import { describeAction, replay } from "../src/shared/engine";
import { proposalActions, proposalRipple } from "../src/shared/proposals";
import { list } from "../src/shared/records";
import {
  bookingRipple,
  chosenActions,
  genericRipple,
  headcountRipple,
  moveFunctionRipple,
} from "../src/shared/ripple";

const TODAY = "2026-09-27";
const events = seedEvents();
const wedding = events.find((e) => e.id === "ananya-rohan") as PersonalEvent;
const birthday = events.find((e) => e.id === "aarav-6") as PersonalEvent;
const mela = events.find((e) => e.id === "green-valley-mela") as CommunityEvent;
const empty = events.find((e) => e.layout === "empty") as PlannrEvent;

describe("previewing a change before it applies", () => {
  test("more guests reach every per-guest budget line, the total and each family's share", () => {
    const r = headcountRipple(wedding, wedding.guests + 20);
    const ids = r.lines.map((l) => l.id);
    expect(ids[0]).toBe("headcount");
    expect(ids).toContain("budget");
    expect(r.lines.filter((l) => l.id.startsWith("split-"))).toHaveLength(
      wedding.budget.split?.sides.length ?? 0,
    );
    // The headcount itself can't be unticked; its consequences can.
    expect(r.lines.find((l) => l.id === "headcount")?.optional).toBe(false);
    const all = replay(wedding, chosenActions(r, new Set(r.lines.map((l) => l.id)))) as PersonalEvent;
    const only = replay(wedding, chosenActions(r, new Set())) as PersonalEvent;
    expect(all.guests).toBe(wedding.guests + 20);
    expect(only.guests).toBe(wedding.guests + 20);
    expect(budgetTotals(all.budget).projected).toBeGreaterThan(budgetTotals(only.budget).projected);
  });

  test("a community event has no headcount to ripple", () => {
    expect(headcountRipple(mela, 100).lines).toEqual([]);
  });

  test("booking a vendor sets its budget line and payments", () => {
    const v = list(wedding, "vendors").find((x) => x.stage !== "booked" && x.quotes.length);
    if (!v) throw new Error("seed has a quoted vendor");
    const r = bookingRipple(wedding, v.id, v.quotes[0]?.id);
    const ids = r.lines.map((l) => l.id);
    expect(ids[0]).toBe("book");
    expect(ids).toContain("payments");
    const after = replay(wedding, chosenActions(r, new Set(ids)));
    expect(list(after, "vendors").find((x) => x.id === v.id)?.stage).toBe("booked");
    expect(bookingRipple(wedding, "nobody").lines).toEqual([]);
  });

  test("moving a function moves its tasks, and warns to tell the vendors", () => {
    const fnId = list(wedding, "vendors").flatMap((v) => v.arrivals ?? [])[0]?.fnId;
    const f = wedding.functions.find((x) => x.id === fnId);
    if (!f) throw new Error("seed has a vendor arriving for a function");
    const date = "2027-04-20";
    const r = moveFunctionRipple(wedding, f.id, date);
    expect(r.lines.map((l) => l.id)).toContain("date");
    expect(r.lines.find((l) => l.id === "vendors")?.warn).toBe(true);
    const after = replay(wedding, chosenActions(r, new Set(r.lines.map((l) => l.id)))) as PersonalEvent;
    expect(after.functions.find((x) => x.id === f.id)?.date).toBe(date);
    expect(moveFunctionRipple(empty, f.id, date).lines).toEqual([]);
  });

  test("any set of actions gets the budget worked out", () => {
    const actions = [{ type: "addTip" as const, eventId: wedding.id }];
    const r = genericRipple(wedding, "Tip", actions, (a) => describeAction(a, wedding));
    expect(r.lines[0]?.title).toContain("chenda");
    expect(r.lines.some((l) => l.id === "budget")).toBe(true);
    // A community event has no family split to show.
    expect(
      genericRipple(mela, "Areca", [{ type: "addAreca", eventId: mela.id }], () => "x").lines,
    ).toHaveLength(1);
  });
});

describe("assistant proposals", () => {
  test("each kind of proposal becomes plan changes only for things the plan has", () => {
    const task = wedding.tasks.list.find((t) => !t.done);
    const category = wedding.budget.categories[0];
    if (!task || !category) throw new Error("seed has tasks and categories");
    expect(
      proposalActions(wedding, { kind: "moveTask", taskId: task.id, due: "2026-10-30" }, TODAY),
    ).toHaveLength(1);
    expect(
      proposalActions(wedding, { kind: "setBudgetLine", categoryId: category.id, amount: 1000 }, TODAY),
    ).toHaveLength(1);
    expect(
      proposalActions(wedding, { kind: "addTask", title: "Ring the florist", due: "2026-10-30" }, TODAY),
    ).toHaveLength(1);
    expect(
      proposalActions(birthday, { kind: "setHeadcount", guests: birthday.guests + 5 }, TODAY),
    ).not.toHaveLength(0);
    const r = proposalRipple(
      wedding,
      [{ kind: "addTask", title: "Ring the florist", due: "2026-10-30" }],
      TODAY,
    );
    expect(r?.lines[0]?.title).toContain("Ring the florist");
  });
});

describe("the on-device assistant", () => {
  test("answers from the plan's own numbers when AI is off", () => {
    expect(reply(wedding, "How ready are we?", "dashboard").text).toMatch(/%/);
    expect(reply(wedding, "What's left to book?", "dashboard").text.length).toBeGreaterThan(20);
    expect(reply(wedding, "Where are we over?", "budget").text.length).toBeGreaterThan(20);
    expect(reply(wedding, "Summarise spending for both families", "dashboard").text).toMatch(/₹/);
    expect(reply(wedding, "What's due this week?", "dashboard").text.length).toBeGreaterThan(20);
    expect(reply(birthday, "Any allergies?", "dashboard").text.length).toBeGreaterThan(20);
    expect(reply(birthday, "What snacks are we serving?", "dashboard").text.length).toBeGreaterThan(20);
    expect(reply(mela, "Summarise funds for the committee", "dashboard").text).toMatch(/₹/);
    expect(reply(mela, "Who's free for food safety 5–8 pm?", "dashboard").text.length).toBeGreaterThan(20);
    expect(reply(empty, "Hello", "dashboard").text).toContain("plan");
  });

  test("proposes a preview for a change instead of making it", () => {
    const cut = reply(wedding, "Cut décor by 50,000", "budget");
    expect(cut.preview ?? cut.action).toBeDefined();
    const tip = reply(wedding, "Add the chenda tip", "dashboard");
    expect(tip.text.length).toBeGreaterThan(20);
  });

  test("introduces itself differently for each kind of event", () => {
    expect(introFor(wedding, "dashboard")).not.toBe(introFor(mela, "dashboard"));
  });
});
