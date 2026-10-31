import type { PlannrEvent } from "../data/types";
import type { Vendor } from "../data/vendorTypes";
import { fundTotals } from "./balances";
import { clock, runsheetFor } from "./derive";
import { functionsOf, vendorsOf } from "./eventLists";
import {
  basics,
  entryCode,
  type FundView,
  type GateView,
  type HelperView,
  isHelper,
  type PublicKind,
  type PublicView,
  type RsvpView,
  type ShiftsView,
  type SiteView,
  type StallsView,
  type VendorView,
} from "./public";
import { list } from "./records";

type Planned = Exclude<PlannrEvent, { layout: "empty" }>;
type Community = Extract<PlannrEvent, { layout: "community" }>;
type ViewOf<K extends PublicKind> = Extract<PublicView, { kind: K }>;
/** One projector per link kind: the mapped type makes the compiler insist on every one. */
export type Projectors = {
  [K in PublicKind]: (ev: Planned, target: string) => ViewOf<K> | undefined;
};
/** First names only: the volunteer sheet is for neighbours, not a directory. */
const firstName = (name: string) => name.split(" ")[0] ?? name;
export function rsvpView(ev: Planned, target: string): RsvpView | undefined {
  const h = list(ev, "households").find((x) => x.id === target);
  if (!h) return undefined;
  const { name, expected, functions, rsvp, meal, stay, pickup, note, lang } = h;
  const saidYes = Object.values(h.rsvp).some((a) => a.status === "yes");
  return {
    kind: "rsvp",
    event: basics(ev, h.functions),
    household: { name, expected, functions, rsvp, meal, stay, pickup, note, lang },
    site: ev.site ? { story: ev.site.story, storyLocal: ev.site.storyLocal, lang: ev.site.lang } : undefined,
    entry: saidYes ? entryCode(h.id) : undefined,
  };
}
export function siteView(ev: Planned): SiteView | undefined {
  if (!ev.site?.published) return undefined;
  const { published: _published, ...site } = ev.site;
  return { kind: "site", event: basics(ev), site };
}
export function helperView(ev: Planned, helper: string): HelperView {
  return {
    kind: "helper",
    event: basics(ev),
    helper,
    tasks: ev.tasks.list
      .filter((t) => isHelper(t.who, helper))
      .sort((a, b) => a.due.localeCompare(b.due))
      .map(({ id, title, due, done, note }) => ({ id, title, due, done, note })),
    checklist: list(ev, "checklist")
      .filter((c) => isHelper(c.owner, helper))
      .map(({ id, label, done }) => ({ id, label, done })),
  };
}
/** Run-sheet items whose owner mentions the vendor's name or contact (by first word). */
function vendorRunsheet(ev: Planned, v: Vendor): VendorView["runsheet"] {
  const names = [v.name, v.contact].filter((n): n is string => !!n).map((n) => n.toLowerCase());
  const mentions = (owner = "") => names.some((n) => owner.toLowerCase().includes(firstName(n)));
  return functionsOf(ev).flatMap((f) =>
    runsheetFor(ev, f.id)
      .filter((r) => mentions(r.owner))
      .map((r) => ({ label: f.label, time: clock(r.time), title: r.title })),
  );
}
export function vendorView(ev: Planned, target: string): VendorView | undefined {
  const v = vendorsOf(ev).find((x) => x.id === target);
  if (!v) return undefined;
  const fns = functionsOf(ev);
  const arrivals = v.arrivals ?? [];
  return {
    kind: "vendor",
    event: basics(
      ev,
      arrivals.map((a) => a.fnId),
    ),
    vendor: { category: v.category, name: v.name, needs: v.needs },
    arrivals: arrivals.flatMap((a) => {
      const f = fns.find((x) => x.id === a.fnId);
      return f ? [{ label: f.label, date: f.date, time: clock(a.time), place: f.place, note: a.note }] : [];
    }),
    runsheet: vendorRunsheet(ev, v),
    payments: list(ev, "payments")
      .filter((p) => p.vendorId === v.id)
      .map(({ label, amount, date, paid }) => ({ label, amount, date, paid })),
  };
}
export function shiftsView(ev: Community): ShiftsView {
  return {
    kind: "shifts",
    event: basics(ev),
    slots: ev.shifts.slots,
    roles: ev.shifts.roles.map((r) => ({
      role: r.role,
      slots: r.slots.map((s) => ({ need: s.need, filled: s.names.length, names: s.names.map(firstName) })),
    })),
  };
}
export function fundView(ev: Community): FundView {
  const f = fundTotals(ev);
  const pending = ev.funds.approvals.filter((a) => a.status === "pending");
  return {
    kind: "fund",
    event: basics(ev),
    sources: f.sources.map(({ label, expected, received }) => ({ label, expected, received })),
    received: f.received,
    expected: f.expected,
    spent: f.spent,
    budget: ev.funds.budget,
    expenses: ev.funds.approvals
      .filter((a) => a.status === "approved")
      .map(({ label, amount }) => ({ label, amount })),
    pending: { count: pending.length, amount: pending.reduce((s, a) => s + a.amount, 0) },
    sponsors: (ev.sponsors ?? []).filter((s) => s.received > 0).map(({ name, tier }) => ({ name, tier })),
  };
}
export function stallsView(ev: Community): StallsView {
  const { stalls } = fundTotals(ev);
  const stallList = ev.stallList ?? [];
  const fees = stallList.map((s) => s.fee);
  return {
    kind: "stalls",
    event: basics(ev),
    fee: fees.length > 0 ? Math.max(...fees) : 0,
    open: Math.max(0, stalls.total - stalls.booked - stalls.requested),
    total: stalls.total,
    categories: [...new Set(stallList.map((s) => s.category).filter((c): c is string => !!c))],
  };
}
export function gateView(ev: Community): GateView {
  const { passes } = fundTotals(ev);
  return {
    kind: "gate",
    event: basics(ev),
    passes: (ev.passList ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      count: p.count,
      checkedIn: p.checkedIn ?? 0,
    })),
    issued: passes.issued,
    inside: passes.checkedIn,
    capacity: passes.capacity,
  };
}
/** Runs `fn` for community events only; other events have no such page. */
export const communityOnly =
  <V>(fn: (ev: Community) => V) =>
  (ev: Planned): V | undefined =>
    ev.layout === "community" ? fn(ev) : undefined;

const PROJECTORS: Projectors = {
  rsvp: rsvpView,
  site: siteView,
  helper: helperView,
  vendor: vendorView,
  shifts: communityOnly(shiftsView),
  fund: communityOnly(fundView),
  album: (ev) => ({ kind: "album", event: basics(ev), photos: list(ev, "album").slice().reverse() }),
  stalls: communityOnly(stallsView),
  gate: communityOnly(gateView),
};

/** The view for one link, or undefined when its target is gone from the plan. */
export function projectView(ev: PlannrEvent, kind: PublicKind, target: string): PublicView | undefined {
  if (ev.layout === "empty") return undefined;
  return PROJECTORS[kind](ev, target);
}
