import type { Household, Rsvp } from "../data/guestTypes";
import type { RunItem } from "../data/recordTypes";
import type { PlannrEvent } from "../data/types";
import type { Vendor } from "../data/vendorTypes";
import { functionsOf, vendorsOf } from "./eventLists";
import { list } from "./records";

/**
 * Numbers the plan shows but never stores: they're worked out from its records each time,
 * so a reply on the RSVP page shows up in the catering count with nothing to keep in sync.
 */

// ---------------------------------------------------------------- guests

/** People a household is bringing: the most who said yes to any one function. */
export function comingCount(h: Household): number {
  return Math.max(0, ...Object.values(h.rsvp).map((a) => (a.status === "yes" ? a.count : 0)));
}

export type HouseholdState = "not-sent" | "waiting" | "coming" | "declined";

export function householdState(h: Household): HouseholdState {
  const answers = h.functions.map((f) => h.rsvp[f]?.status ?? "pending");
  if (answers.some((a) => a === "yes")) return "coming";
  if (answers.length > 0 && answers.every((a) => a === "no")) return "declined";
  return h.invitedAt ? "waiting" : "not-sent";
}

/** The guest summary: from households when the plan has them, else the plan's own figures. */
export function rsvpSummary(ev: PlannrEvent): Rsvp {
  const hs = list(ev, "households");
  if (hs.length === 0)
    return ev.layout === "personal"
      ? ev.rsvp
      : { total: 0, invited: 0, confirmed: 0, declined: 0, pending: 0, notSent: 0 };
  let total = 0;
  let invited = 0;
  let confirmed = 0;
  let declined = 0;
  let pending = 0;
  let notSent = 0;
  for (const h of hs) {
    total += h.expected;
    const state = householdState(h);
    if (state === "not-sent") {
      notSent += h.expected;
      continue;
    }
    invited += h.expected;
    if (state === "coming") confirmed += comingCount(h);
    else if (state === "declined") declined += h.expected;
    else pending += h.expected;
  }
  return { total, invited, confirmed, declined, pending, notSent };
}

export interface FunctionCount {
  fnId: string;
  invited: number;
  yes: number;
  no: number;
  waiting: number;
  households: number;
}

/** For one function: who's invited, coming, not coming and still to answer. */
export function functionCount(ev: PlannrEvent, fnId: string): FunctionCount {
  const out: FunctionCount = { fnId, invited: 0, yes: 0, no: 0, waiting: 0, households: 0 };
  for (const h of list(ev, "households")) {
    if (!h.functions.includes(fnId)) continue;
    out.households += 1;
    out.invited += h.expected;
    const a = h.rsvp[fnId];
    if (a?.status === "yes") out.yes += a.count;
    else if (a?.status === "no") out.no += h.expected;
    else out.waiting += h.expected;
  }
  return out;
}

/** Expected at a function: those coming plus most of those yet to answer. */
export function expectedAt(c: FunctionCount, turnout = 0.8): number {
  return c.yes + Math.round(c.waiting * turnout);
}

/** Households that look like the same family entered twice: the same phone, or the same name. */
export function duplicateGroups(hs: Household[]): Household[][] {
  const nameKey = (h: Household) =>
    `n:${h.name
      .toLowerCase()
      .replace(/\b(family|the|and)\b|&/g, "")
      .replace(/[^a-z\u0d00-\u0d7f\u0900-\u097f\u0b80-\u0bff]/g, "")}`;
  const phoneKey = (h: Household) => (h.phone && h.phone.length >= 8 ? `p:${h.phone.slice(-10)}` : undefined);
  // Union-find over households that share either key.
  const parent = hs.map((_, i) => i);
  // Union-find with path halving: each step points a household at its grandparent.
  const find = (start: number): number => {
    let i = start;
    while (parent[i] !== i) {
      const next = parent[parent[i] ?? i] ?? i;
      parent[i] = next;
      i = next;
    }
    return i;
  };
  const seen = new Map<string, number>();
  hs.forEach((h, i) => {
    for (const k of [nameKey(h), phoneKey(h)]) {
      if (!k) continue;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else parent[find(i)] = find(j);
    }
  });
  const groups = new Map<number, Household[]>();
  hs.forEach((h, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), h]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

// ---------------------------------------------------------------- vendors

export const STAGE_LABEL: Record<Vendor["stage"], string> = {
  needed: "Still to find",
  enquired: "Enquired",
  quoted: "Quote in",
  booked: "Booked",
};

export function vendorSummary(ev: PlannrEvent): { booked: string[]; talking: string[]; needed: string[] } {
  const vs = vendorsOf(ev);
  return {
    booked: vs.filter((v) => v.stage === "booked").map((v) => v.category),
    talking: vs.filter((v) => v.stage === "enquired" || v.stage === "quoted").map((v) => v.category),
    needed: vs.filter((v) => v.stage === "needed").map((v) => v.category),
  };
}

/** A quote's total for this plan: per-guest prices times the planned headcount. */
export function quoteTotal(amount: number, perGuest: boolean | undefined, guests: number): number {
  return perGuest ? amount * guests : amount;
}

// ---------------------------------------------------------------- the day

/** "14:30" → "2:30 pm". */
export function clock(time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function runsheetFor(ev: PlannrEvent, fnId: string): RunItem[] {
  return list(ev, "runsheet")
    .filter((r) => r.fnId === fnId)
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** What's happening at a time of day, and what comes next. */
export function nowAndNext(items: RunItem[], hhmm: string): { now?: RunItem; next: RunItem[] } {
  const open = items.filter((i) => !i.done);
  const started = open.filter((i) => i.time <= hhmm);
  const now = started[started.length - 1];
  return { now, next: open.filter((i) => i.time > hhmm) };
}

/** Checked in at a function, against the number expected there. */
export function checkInCount(ev: PlannrEvent, fnId: string): { inside: number; expected: number } {
  const c = functionCount(ev, fnId);
  const inside = list(ev, "households").reduce((s, h) => s + (h.checkedIn?.[fnId] ?? 0), 0);
  return { inside, expected: c.yes || c.invited };
}

/** The function on a date, or the next one after it. */
export function functionOn(ev: PlannrEvent, date: string) {
  const fns = functionsOf(ev)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  return fns.find((f) => f.date === date) ?? fns.find((f) => f.date > date) ?? fns[fns.length - 1];
}
