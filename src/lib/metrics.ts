import type { BudgetPlan, Category, CommunityEvent, PersonalEvent } from "../data/types";
import { clamp } from "./format";

export interface BudgetTotals {
  total: number;
  planned: number;
  spent: number;
  remaining: number;
  projected: number;
  over: number;
  unallocated: number;
}

export function categoryProjected(c: Category): number {
  return c.projected ?? c.planned;
}

export function budgetTotals(plan: BudgetPlan): BudgetTotals {
  const planned = plan.categories.reduce((s, c) => s + c.planned, 0);
  const spent = plan.categories.reduce((s, c) => s + c.spent, 0);
  const projected = plan.categories.reduce((s, c) => s + categoryProjected(c), 0);
  return {
    total: plan.total,
    planned,
    spent,
    remaining: plan.total - spent,
    projected,
    over: projected - plan.total,
    unallocated: plan.total - planned,
  };
}

export interface WhatIfResult {
  deltas: { category: string; amount: number }[];
  projection: number;
  /** Positive means under plan. */
  headroom: number;
}

/** What changing the guest count or total would do, without touching the plan. */
export function whatIf(plan: BudgetPlan, guests: number, total: number): WhatIfResult {
  const base = plan.whatIf;
  const projected = budgetTotals(plan).projected;
  if (!base) return { deltas: [], projection: projected, headroom: total - projected };
  const diff = guests - base.baseGuests;
  const deltas = base.rates.map((r) => ({ category: r.category, amount: diff * r.perGuest }));
  const projection = projected + deltas.reduce((s, d) => s + d.amount, 0);
  return { deltas, projection, headroom: total - projection };
}

/** Who owes whom so spending so far matches the agreed split. */
export function settle(split: NonNullable<BudgetPlan["split"]>, spent: number) {
  const sides = split.sides.map((s) => ({ ...s, owed: Math.round(spent * s.share) }));
  const [a, b] = sides;
  if (!a || !b) return { sides, debtor: undefined, creditor: undefined, amount: 0 };
  const aBalance = a.paid - a.owed;
  if (aBalance === 0) return { sides, debtor: undefined, creditor: undefined, amount: 0 };
  return aBalance > 0
    ? { sides, debtor: b.name, creditor: a.name, amount: aBalance }
    : { sides, debtor: a.name, creditor: b.name, amount: -aBalance };
}

export interface Readiness {
  tasksDone: number;
  tasksTotal: number;
  tasks: number;
  vendorsBooked: number;
  vendorsTotal: number;
  vendors: number;
  guestsConfirmed: number;
  guests: number;
  budget: number;
  overall: number;
  overdue: number;
}

export function tasksDone(t: PersonalEvent["tasks"] | CommunityEvent["tasks"]): number {
  return t.doneBefore + t.list.filter((x) => x.done).length;
}

/** Weighted so tasks and RSVPs move it most; ticking a task moves the ring. */
export function personalReadiness(ev: PersonalEvent, today: string): Readiness {
  const done = tasksDone(ev.tasks);
  const booked = ev.vendors.booked.length;
  const vendorsTotal = booked + ev.vendors.talking.length + ev.vendors.needed.length;
  const tasks = clamp(done / Math.max(1, ev.tasks.total));
  const vendors = clamp(booked / Math.max(1, vendorsTotal));
  const guests = clamp(ev.rsvp.confirmed / Math.max(1, ev.rsvp.total));
  const budget = clamp(ev.budgetScore);
  return {
    tasksDone: done,
    tasksTotal: ev.tasks.total,
    tasks,
    vendorsBooked: booked,
    vendorsTotal,
    vendors,
    guestsConfirmed: ev.rsvp.confirmed,
    guests,
    budget,
    overall: 0.3 * tasks + 0.2 * vendors + 0.3 * guests + 0.2 * budget,
    overdue: ev.tasks.list.filter((t) => !t.done && t.due < today).length,
  };
}

export interface CommunityReadiness {
  funds: number;
  tasks: number;
  tasksDone: number;
  permitsDone: number;
  permitsTotal: number;
  permits: number;
  volunteersFilled: number;
  volunteersNeeded: number;
  volunteers: number;
  passes: number;
  stalls: number;
  overall: number;
}

export function communityReadiness(ev: CommunityEvent): CommunityReadiness {
  const expected = ev.funds.sources.reduce((s, x) => s + x.expected, 0);
  const received = ev.funds.sources.reduce((s, x) => s + x.received, 0);
  const funds = clamp(received / Math.max(1, expected));
  const done = tasksDone(ev.tasks);
  const tasks = clamp(done / ev.tasks.total);
  const permitRows = ev.permits.filter((p) => p.permit);
  const permitsDone = permitRows.filter((p) => p.tone === "ok").length;
  const permits = clamp(permitsDone / Math.max(1, permitRows.length));
  let filled = 0;
  let needed = 0;
  for (const r of ev.shifts.roles)
    for (const s of r.slots) {
      needed += s.need;
      filled += Math.min(s.need, s.names.length);
    }
  const volunteers = clamp(filled / Math.max(1, needed));
  const passes = clamp(ev.passes.issued / ev.passes.capacity);
  const stalls = clamp(ev.stalls.booked / ev.stalls.total);
  return {
    funds,
    tasks,
    tasksDone: done,
    permitsDone,
    permitsTotal: permitRows.length,
    permits,
    volunteersFilled: filled,
    volunteersNeeded: needed,
    volunteers,
    passes,
    stalls,
    overall: 0.1 * funds + 0.3 * tasks + 0.3 * permits + 0.1 * volunteers + 0.1 * passes + 0.1 * stalls,
  };
}
