import type {
  CommunityEvent,
  FundSource,
  Household,
  PersonalEvent,
  PlannrEvent,
  Rsvp,
  RunItem,
  Vendor,
} from "../data/types";
import { functionsOf, list, vendorsOf } from "./records";

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
  if (answers.length && answers.every((a) => a === "no")) return "declined";
  return h.invitedAt ? "waiting" : "not-sent";
}

/** The guest summary: from households when the plan has them, else the plan's own figures. */
export function rsvpSummary(ev: PlannrEvent): Rsvp {
  const hs = list(ev, "households");
  if (!hs.length)
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
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i] ?? i] ?? i;
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

// ---------------------------------------------------------------- money

export interface SideBalance {
  name: string;
  share: number;
  paid: number;
  fair: number;
  /** Positive: the others owe this side. Negative: this side owes. */
  balance: number;
  color: string;
}

/** Each family's share of what's been paid so far, after settle-ups. */
export function splitBalances(ev: PersonalEvent): SideBalance[] {
  const split = ev.budget.split;
  if (!split) return [];
  const paid = new Map(split.sides.map((s) => [s.name, s.paid]));
  for (const t of split.settlements ?? []) {
    paid.set(t.from, (paid.get(t.from) ?? 0) + t.amount);
    paid.set(t.to, (paid.get(t.to) ?? 0) - t.amount);
  }
  const total = [...paid.values()].reduce((a, b) => a + b, 0);
  return split.sides.map((s) => {
    const p = paid.get(s.name) ?? 0;
    const fair = Math.round(total * s.share);
    return { name: s.name, share: s.share, paid: p, fair, balance: p - fair, color: s.color };
  });
}

/** The fewest transfers that even the families out. */
export function settleUp(balances: SideBalance[]): { from: string; to: string; amount: number }[] {
  const owes = balances.filter((b) => b.balance < -0.5).map((b) => ({ name: b.name, left: -b.balance }));
  const owed = balances.filter((b) => b.balance > 0.5).map((b) => ({ name: b.name, left: b.balance }));
  const out: { from: string; to: string; amount: number }[] = [];
  for (const d of owes)
    for (const c of owed) {
      if (d.left <= 0.5) break;
      const amount = Math.round(Math.min(d.left, c.left));
      if (amount <= 0) continue;
      out.push({ from: d.name, to: c.name, amount });
      d.left -= amount;
      c.left -= amount;
    }
  return out;
}

/** Payments due on or before a date that aren't paid yet, soonest first. */
export function paymentsDue(ev: PlannrEvent, until: string) {
  return list(ev, "payments")
    .filter((p) => !p.paid && p.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function giftTotals(ev: PlannrEvent): { count: number; cash: number; toThank: number } {
  const gifts = list(ev, "gifts");
  return {
    count: gifts.length,
    cash: gifts.reduce((s, g) => s + (g.amount ?? 0), 0),
    toThank: gifts.filter((g) => !g.thanked).length,
  };
}

// ---------------------------------------------------------------- community

export interface FundTotals {
  /** Manual sources plus sponsorships and stall fees from their lists. */
  sources: FundSource[];
  expected: number;
  received: number;
  spent: number;
  pendingApprovals: number;
  stalls: { booked: number; total: number; paid: number; requested: number };
  passes: { issued: number; capacity: number; checkedIn: number };
}

export function fundTotals(ev: CommunityEvent): FundTotals {
  const stalls = ev.stallList ?? [];
  const sponsors = ev.sponsors ?? [];
  const sources: FundSource[] = [...ev.funds.sources];
  if (sponsors.length) {
    const exp = sponsors.reduce((s, x) => s + x.amount, 0);
    const rec = sponsors.reduce((s, x) => s + x.received, 0);
    const paidCount = sponsors.filter((s) => s.received >= s.amount).length;
    sources.push({
      id: "sponsors",
      label: `Sponsors · ${paidCount} of ${sponsors.length} paid`,
      expected: exp,
      received: rec,
      note: exp > rec ? `₹${(exp - rec).toLocaleString("en-IN")} due` : "received",
      tone: exp > rec ? "due" : "ok",
    });
  }
  const confirmed = stalls.filter((s) => s.status === "confirmed");
  if (stalls.length) {
    const exp = confirmed.reduce((s, x) => s + x.fee, 0);
    const rec = confirmed.filter((s) => s.paid).reduce((s, x) => s + x.fee, 0);
    const unpaid = confirmed.filter((s) => !s.paid).length;
    sources.push({
      id: "stall-fees",
      label: `Stall fees · ${confirmed.length} stalls`,
      expected: exp,
      received: rec,
      note: unpaid ? `${unpaid} pending` : "received",
      tone: unpaid ? "due" : "ok",
    });
  }
  const passes = ev.passList;
  return {
    sources,
    expected: sources.reduce((s, x) => s + x.expected, 0),
    received: sources.reduce((s, x) => s + x.received, 0),
    spent: ev.funds.spent,
    pendingApprovals: ev.funds.approvals.filter((a) => a.status === "pending").length,
    stalls: {
      booked: stalls.length ? confirmed.length : ev.stalls.booked,
      total: ev.stalls.total,
      paid: confirmed.filter((s) => s.paid).length,
      requested: stalls.filter((s) => s.status === "requested").length,
    },
    passes: {
      issued: passes?.length ? passes.reduce((s, p) => s + p.count, 0) : ev.passes.issued,
      capacity: ev.passes.capacity,
      checkedIn: (passes ?? []).reduce((s, p) => s + (p.checkedIn ?? 0), 0),
    },
  };
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
