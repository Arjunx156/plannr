import type { FundSource } from "../data/communityTypes";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../data/types";
import { list } from "./records";

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
  if (sponsors.length > 0) {
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
  if (stalls.length > 0) {
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
      booked: stalls.length > 0 ? confirmed.length : ev.stalls.booked,
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
