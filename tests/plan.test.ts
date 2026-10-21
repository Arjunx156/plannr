import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent } from "../src/data/types";
import { daysUntil, dueLabel } from "../src/lib/dates";
import { inr, inrShort, inrSigned } from "../src/lib/format";
import { emptyProfile, nextQuestion, parseDescription } from "../src/lib/intake";
import { budgetTotals, communityReadiness, personalReadiness, settle, whatIf } from "../src/lib/metrics";
import { draftPlan, splitBudget } from "../src/lib/plan";
import { initialState, reducer } from "../src/store/store";

const [wedding, birthday, mela] = seedEvents() as [PersonalEvent, PersonalEvent, CommunityEvent];

describe("money", () => {
  test("uses lakh grouping and true minus signs", () => {
    expect(inr(1800000)).toBe("₹18,00,000");
    expect(inrSigned(-60480)).toBe("−₹60,480");
    expect(inrSigned(36288)).toBe("+₹36,288");
    expect(inrShort(685000)).toBe("₹6.85L");
    expect(inrShort(1800000)).toBe("₹18L");
    expect(inrShort(14200)).toBe("₹14,200");
  });
});

describe("dates", () => {
  test("countdowns match the story's today", () => {
    expect(daysUntil(wedding.date)).toBe(210);
    expect(daysUntil(birthday.date)).toBe(20);
    expect(daysUntil(mela.date)).toBe(41);
    expect(dueLabel("2026-09-24")).toEqual({ text: "3 days late", late: true });
  });
});

describe("intake", () => {
  test("reads the Kerala wedding sentence", () => {
    const p = parseDescription(
      "Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh, end of April next year. It's for my sister Ananya and Rohan.",
      emptyProfile(),
    );
    expect(p.kind).toBe("wedding");
    expect(p.city).toBe("Kochi");
    expect(p.guests).toBe(250);
    expect(p.budget).toBe(1800000);
    expect(p.date).toBe("2027-04-25");
    expect(p.dateText).toBe("Late Apr 2027");
    expect(p.names).toBe("Ananya & Rohan");
    expect(p.functions).toEqual(["Ceremony", "Reception"]);
    expect(p.style).toBe("Kerala-style");
  });

  test("adds venues, functions and needs from a follow-up", () => {
    const first = parseDescription("Kerala wedding in Kochi, 250 guests, ₹18 lakh, April", emptyProfile());
    const p = parseDescription(
      "Kayal Heritage Centre in Maradu or Lotus Banquets. Also mehendi and haldi the days before. Two grandparents use wheelchairs.",
      first,
    );
    expect(p.venueStatus).toBe("Shortlisted");
    expect(p.functions).toEqual(["Mehendi", "Haldi", "Ceremony"]);
    expect(p.needs).toContain("2 wheelchair users");
    expect(p.city).toBe("Kochi");
  });

  test("reads kids plus adults, thousands and relative dates", () => {
    const p = parseDescription(
      "Space-themed 6th birthday at home for Aarav, 30 kids and 20 adults, ₹40,000, in 3 weeks",
      emptyProfile(),
    );
    expect(p.kind).toBe("birthday");
    expect(p.guests).toBe(50);
    expect(p.budget).toBe(40000);
    expect(p.style).toBe("Space theme");
    expect(p.venues).toBe("Home");
    expect(p.date).toBe("2026-10-17");
  });

  test("asks only for what is missing", () => {
    expect(nextQuestion(emptyProfile(), new Set())?.field).toBe("kind");
    const p = parseDescription(
      "Diwali mela for our society in Kakkanad, 600 people, ₹2.5 lakh, November",
      emptyProfile(),
    );
    expect(p.budget).toBe(250000);
    expect(nextQuestion(p, new Set())?.field).toBe("venue");
    expect(nextQuestion(p, new Set(["venue", "extras", "priorities"]))).toBeNull();
  });
});

describe("plan", () => {
  test("the wedding split reproduces the designed numbers and sums to the total", () => {
    const lines = splitBudget("wedding", 1800000);
    expect(lines.slice(0, 5).map((l) => l.amount)).toEqual([450000, 320000, 240000, 220000, 180000]);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(1800000);
    const rest = lines.slice(5).reduce((s, l) => s + l.amount, 0);
    expect(rest).toBe(390000);
  });

  test("odd budgets still add up exactly", () => {
    for (const total of [37000, 412345, 2500000])
      for (const kind of ["wedding", "birthday", "community", "other"] as const)
        expect(splitBudget(kind, total).reduce((s, l) => s + l.amount, 0)).toBe(total);
  });

  test("drafts the plan summary for the sample wedding", () => {
    const p = parseDescription(
      "Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh, end of April next year. Also mehendi and haldi. Two grandparents use wheelchairs.",
      emptyProfile(),
    );
    const plan = draftPlan({ ...p, priorities: ["Food", "Photography", "Ceremony décor"] });
    expect(plan.tasks).toBe(71);
    expect(plan.vendors).toHaveLength(11);
    expect(plan.guests.groups.map((g) => g.count)).toEqual([110, 100, 30, 10]);
    expect(plan.timeline.map((t) => t.when)).toEqual(["NOW–OCT", "JAN", "MAR", "WEEK OF"]);
    expect(plan.basis).toBe(
      "Based on 250 guests in Kochi, four functions, April, and food · photography · ceremony décor as priorities.",
    );
    expect(plan.guests.note).toBe("Step-free entry and 2 wheelchair spaces added to venue questions.");
  });
});

describe("budget", () => {
  test("totals match the planner", () => {
    const t = budgetTotals(wedding.budget);
    expect(t.spent).toBe(685000);
    expect(t.remaining).toBe(1115000);
    expect(t.projected).toBe(1864000);
    expect(t.over).toBe(64000);
  });

  test("what-if at 220 guests lands ₹3,680 under plan", () => {
    const r = whatIf(wedding.budget, 220, 1800000);
    expect(r.deltas.map((d) => d.amount)).toEqual([-60480, -4200, -3000]);
    expect(r.headroom).toBe(3680);
  });

  test("the family split settles at ₹49,000", () => {
    const split = wedding.budget.split;
    if (!split) throw new Error("wedding has a split");
    const s = settle(split, 685000);
    expect(s.debtor).toBe("Rohan's family");
    expect(s.amount).toBe(49000);
  });
});

describe("readiness", () => {
  test("matches the dashboards", () => {
    expect(Math.round(personalReadiness(wedding, "2026-09-27").overall * 100)).toBe(38);
    expect(Math.round(personalReadiness(birthday, "2026-09-27").overall * 100)).toBe(61);
    const m = communityReadiness(mela);
    expect(Math.round(m.overall * 100)).toBe(54);
    expect([m.volunteersFilled, m.volunteersNeeded]).toEqual([19, 24]);
  });

  test("ticking a task moves it", () => {
    const before = personalReadiness(wedding, "2026-09-27");
    const s = reducer(initialState(), { type: "toggleTask", eventId: wedding.id, taskId: "w1" });
    const after = personalReadiness(s.events[0] as PersonalEvent, "2026-09-27");
    expect(after.tasksDone).toBe(before.tasksDone + 1);
    expect(after.overdue).toBe(before.overdue - 1);
  });

  test("cutting décor drops the projection to ₹18,14,000", () => {
    const s = reducer(initialState(), { type: "applyChange", eventId: wedding.id, change: "cut-decor" });
    expect(budgetTotals((s.events[0] as PersonalEvent).budget).projected).toBe(1814000);
  });
});

describe("intake edge cases", () => {
  test("place names and verbs don't read as months", () => {
    const p = parseDescription(
      "Kerala wedding in Kochi, 250 guests, ₹18 lakh, end of April next year",
      emptyProfile(),
    );
    const q = parseDescription("Kayal Heritage Centre in Maradu. We may add a sangeet.", p);
    expect(q.date).toBe("2027-04-25");
    expect(q.city).toBe("Kochi");
    expect(q.functions).toContain("Sangeet");
  });

  test("names the birthday child from 'for Aarav'", () => {
    expect(parseDescription("6th birthday for Aarav, 40 guests", emptyProfile()).names).toBe("Aarav");
  });
});
