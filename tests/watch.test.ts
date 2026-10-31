import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { PlannrEvent } from "../src/data/types";
import { addDays } from "../src/lib/dates";
import { rsvpSummary } from "../src/shared/derive";
import { applyEventAction } from "../src/shared/engine";
import { functionsOf } from "../src/shared/eventLists";
import { morningMessage, remindersFor } from "../src/shared/reminders";
import { rainWatch, watchPlan } from "../src/shared/watch";
import { community, personal } from "./support";

const events = seedEvents();
const wedding = personal(events.find((e) => e.id === "ananya-rohan"));
const mela = community(events.find((e) => e.id === "green-valley-mela"));
const TODAY = addDays(wedding.date, -60);

describe("what needs attention", () => {
  test("quotes the plan's own numbers and every action does something", () => {
    const w = watchPlan(wedding, TODAY);
    expect(w.length).toBeGreaterThan(0);
    for (const x of w) {
      expect(x.text.length).toBeGreaterThan(10);
      for (const a of [x.primary, x.secondary])
        if (a?.kind === "go") expect(a.to).toStartWith(`/events/${wedding.id}`);
    }
    const ids = w.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(w.map((x) => x.rank)).toEqual([...w.map((x) => x.rank)].sort((a, b) => a - b));
  });

  test("an overrun can be made the plan, and then it's no longer flagged", () => {
    const over = watchPlan(wedding, TODAY).find((x) => x.id.startsWith("over:"));
    expect(over).toBeDefined();
    const apply = over?.secondary;
    expect(apply?.kind).toBe("apply");
    let ev: PlannrEvent = wedding;
    if (apply?.kind === "apply") for (const a of apply.actions) ev = applyEventAction(ev, a);
    expect(watchPlan(ev, TODAY).some((x) => x.id === over?.id)).toBe(false);
  });

  test("an overdue payment is flagged and clears once paid", () => {
    const unpaid = wedding.budget.payments.find((p) => !p.paid);
    if (!unpaid) return;
    const after = addDays(unpaid.date, 1);
    const w = watchPlan(wedding, after);
    expect(w.some((x) => x.id.startsWith("pay-late:") && x.id.includes(unpaid.id))).toBe(true);
    const paid = applyEventAction(wedding, {
      type: "markPaid",
      eventId: wedding.id,
      paymentId: unpaid.id,
      paid: true,
    });
    expect(watchPlan(paid, after).some((x) => x.id.startsWith("pay-late:") && x.id.includes(unpaid.id))).toBe(
      false,
    );
  });

  test("a committee sees its claims, permits and open shifts", () => {
    const w = watchPlan(mela, addDays(mela.date, -10));
    expect(w.some((x) => x.id.startsWith("approvals:"))).toBe(true);
    expect(w.every((x) => x.primary?.kind !== "go" || x.primary.to.startsWith(`/events/${mela.id}`))).toBe(
      true,
    );
  });

  test("past and archived events stay quiet", () => {
    expect(watchPlan(wedding, addDays(wedding.date, 1))).toEqual([]);
    expect(watchPlan({ ...wedding, archived: true }, TODAY)).toEqual([]);
  });

  test("rain only counts when it's likely", () => {
    const risks = [
      { fnId: "haldi", label: "Haldi", date: TODAY, chance: 30 },
      { fnId: "ceremony", label: "Ceremony", date: TODAY, chance: 80 },
    ];
    const w = rainWatch(wedding, risks);
    expect(w.length).toBe(1);
    expect(w[0]?.text).toContain("80%");
  });
});

describe("a family's notices", () => {
  const notice = (ev: PlannrEvent, today: string, prefix: string) =>
    watchPlan(ev, today).find((x) => x.id.startsWith(prefix));
  const households = wedding.households ?? [];
  const first = functionsOf(wedding)
    .map((f) => f.date)
    .sort()[0];
  if (!first) throw new Error("the demo wedding has functions");

  test("a guest list that has drifted from the budget's headcount offers to re-plan for it", () => {
    const { total } = rsvpSummary(wedding);
    expect(total).toBeGreaterThan(0);
    const drifted = notice({ ...wedding, guests: total + 100 }, TODAY, "headcount:");
    expect(drifted?.primary).toMatchObject({ kind: "headcount", guests: total });
  });

  test("a venue with more guests expected than seats is flagged", () => {
    const fn = functionsOf(wedding).find((f) => f.date >= TODAY);
    if (!fn) throw new Error("the demo wedding has functions ahead");
    const small = {
      ...wedding,
      functions: functionsOf(wedding).map((f) => (f.id === fn.id ? { ...f, capacity: 1 } : f)),
    };
    expect(notice(small, TODAY, `capacity:${fn.id}:`)?.text).toContain("seats 1");
  });

  test("invitations not sent grow urgent as the first function nears; then unanswered ones are chased", () => {
    const unsent = {
      ...wedding,
      households: households.map(({ invitedAt: _, ...h }) => ({ ...h, rsvp: {} })),
    };
    expect(notice(unsent, addDays(first, -90), "invites:")).toBeUndefined();
    expect(notice(unsent, addDays(first, -45), "invites:")?.tone).toBe("info");
    expect(notice(unsent, addDays(first, -10), "invites:")?.tone).toBe("warn");
    const waiting = { ...wedding, households: households.map((h) => ({ ...h, invitedAt: TODAY, rsvp: {} })) };
    expect(notice(waiting, addDays(first, -30), "waiting:")).toBeUndefined();
    expect(notice(waiting, addDays(first, -10), "waiting:")?.text).toContain("replied yet");
  });

  test("a family entered twice is spotted, and so are several", () => {
    const [a, b] = households;
    if (!a || !b) throw new Error("the demo wedding has households");
    const once = notice(
      { ...wedding, households: [...households, { ...a, id: "again-a" }] },
      TODAY,
      "dupes:",
    );
    expect(once?.text).toContain("it was added twice");
    const twice = {
      ...wedding,
      households: [...households, { ...a, id: "again-a" }, { ...b, id: "again-b" }],
    };
    expect(notice(twice, TODAY, "dupes:")?.text).toContain("they were added twice");
  });
});

describe("a committee's notices", () => {
  const permit = (due: string) => ({
    ...mela,
    permits: [{ id: "p1", label: "Police", status: "Applied", tone: "due" as const, due }],
  });
  const near = addDays(mela.date, -30);

  test("a permit shows three weeks out, turns urgent in the last week, and says when it's overdue", () => {
    const on = (due: string) => watchPlan(permit(due), near).find((x) => x.id.startsWith("permit:p1"));
    expect(on(addDays(near, 30))).toBeUndefined();
    expect(on(addDays(near, 14))).toMatchObject({ tone: "info", label: "Permit" });
    expect(on(addDays(near, 3))?.tone).toBe("warn");
    expect(on(addDays(near, -2))?.label).toBe("Permit overdue");
  });

  test("spending more than has come in is flagged", () => {
    const short = { ...mela, funds: { ...mela.funds, spent: 100_000_000 } };
    expect(watchPlan(short, near).some((x) => x.id.startsWith("cash:"))).toBe(true);
  });
});

describe("the morning reminder", () => {
  test("lists today's functions, payments and tasks, and stays silent on a clear day", () => {
    const fn = wedding.functions[0];
    if (!fn) return;
    const lines = remindersFor(wedding, fn.date);
    expect(lines[0]?.text).toContain(`${fn.label} is today`);
    const msg = morningMessage([wedding], fn.date);
    expect(msg?.title).toBe(`Today for ${wedding.name}`);
    expect(msg?.url).toBe(`/events/${wedding.id}`);
    const quiet = {
      ...wedding,
      tasks: { ...wedding.tasks, list: [] },
      budget: { ...wedding.budget, payments: [] },
    };
    expect(morningMessage([quiet], "2020-01-01")).toBeUndefined();
  });
});
