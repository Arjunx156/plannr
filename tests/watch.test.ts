import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent } from "../src/data/types";
import { addDays } from "../src/lib/dates";
import { applyEventAction } from "../src/shared/engine";
import { morningMessage, remindersFor } from "../src/shared/reminders";
import { rainWatch, watchPlan } from "../src/shared/watch";

const events = seedEvents();
const wedding = events.find((e) => e.id === "ananya-rohan") as PersonalEvent;
const mela = events.find((e) => e.id === "green-valley-mela") as CommunityEvent;
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
    let ev = wedding as Parameters<typeof applyEventAction>[0];
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
    expect(
      w.every((x) => !x.primary || x.primary.kind !== "go" || x.primary.to.startsWith(`/events/${mela.id}`)),
    ).toBe(true);
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
