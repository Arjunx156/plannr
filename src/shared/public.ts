import type {
  Announcement,
  FunctionDay,
  Household,
  Photo,
  PlannrEvent,
  SiteInfo,
  Task,
  Vendor,
} from "../data/types";
import { addDays } from "../lib/dates";
import { clock, fundTotals, runsheetFor } from "./derive";
import { functionsOf, list, vendorsOf } from "./records";

/**
 * What each shared link shows. Built from the plan by one pure function per link kind, on
 * the server for real links and in the browser for the demo's previews, so both look the
 * same. Each view carries only what that person needs: a household sees its own invitation,
 * a vendor their call sheet, residents the fund totals. Nothing else leaves the plan.
 */

export type PublicKind =
  | "rsvp"
  | "helper"
  | "vendor"
  | "shifts"
  | "fund"
  | "site"
  | "album"
  | "stalls"
  | "gate";

/** Days a link keeps working after the event's last day. Photos and the fund report are for afterwards. */
const LINK_DAYS_AFTER: Partial<Record<PublicKind, number>> = { album: 180, fund: 180 };
const LINK_DAYS_DEFAULT = 30;

/** The last day a shared link works: a while after the event, so old links don't stay open for ever. */
export function linkExpiry(ev: PlannrEvent, kind: PublicKind): string {
  const last = functionsOf(ev)
    .map((f) => f.date)
    .reduce((a, b) => (b > a ? b : a), ev.date);
  return addDays(last, LINK_DAYS_AFTER[kind] ?? LINK_DAYS_DEFAULT);
}

export interface PublicFunction {
  id: string;
  label: string;
  date: string;
  time?: string;
  place?: string;
  address?: string;
  dress?: string;
}

export interface PublicBasics {
  name: string;
  kind: PlannrEvent["kind"];
  date: string;
  hue: PlannrEvent["hue"];
  functions: PublicFunction[];
  announcements: Announcement[];
  /** The family's language for guest pages, e.g. "ml". */
  lang?: string;
}

export interface RsvpView {
  kind: "rsvp";
  event: PublicBasics;
  household: Pick<
    Household,
    "name" | "expected" | "functions" | "rsvp" | "meal" | "stay" | "pickup" | "note" | "lang"
  >;
  site?: Pick<SiteInfo, "story" | "storyLocal" | "lang">;
  /** What the QR at the entrance holds once they've said yes; the hosts scan it on the day. */
  entry?: string;
}

export interface SiteView {
  kind: "site";
  event: PublicBasics;
  site: Omit<SiteInfo, "published">;
}

export interface HelperView {
  kind: "helper";
  event: PublicBasics;
  helper: string;
  tasks: Pick<Task, "id" | "title" | "due" | "done" | "note">[];
  checklist: { id: string; label: string; done: boolean }[];
}

export interface VendorView {
  kind: "vendor";
  event: PublicBasics;
  vendor: { category: string; name: string; needs?: string };
  arrivals: { label: string; date: string; time: string; place?: string; note?: string }[];
  runsheet: { label: string; time: string; title: string }[];
  payments: { label: string; amount: number; date: string; paid: boolean }[];
}

export interface ShiftsView {
  kind: "shifts";
  event: PublicBasics;
  slots: string[];
  roles: { role: string; slots: { need: number; filled: number; names: string[] }[] }[];
}

export interface FundView {
  kind: "fund";
  event: PublicBasics;
  sources: { label: string; expected: number; received: number }[];
  received: number;
  expected: number;
  spent: number;
  budget: number;
  expenses: { label: string; amount: number }[];
  pending: { count: number; amount: number };
  sponsors: { name: string; tier: string }[];
}

export interface AlbumView {
  kind: "album";
  event: PublicBasics;
  photos: Photo[];
}

export interface StallsView {
  kind: "stalls";
  event: PublicBasics;
  fee: number;
  open: number;
  total: number;
  categories: string[];
}

export interface GateView {
  kind: "gate";
  event: PublicBasics;
  passes: { id: string; name: string; count: number; checkedIn: number }[];
  issued: number;
  inside: number;
  capacity: number;
}

export type PublicView =
  | RsvpView
  | SiteView
  | HelperView
  | VendorView
  | ShiftsView
  | FundView
  | AlbumView
  | StallsView
  | GateView;

function fn(f: FunctionDay): PublicFunction {
  return {
    id: f.id,
    label: f.label,
    date: f.date,
    time: f.time,
    place: f.place,
    address: f.address,
    dress: f.dress,
  };
}

/** Event basics everyone with a link may see. Private functions only for those invited to them. */
export function basics(ev: PlannrEvent, onlyFunctions?: string[]): PublicBasics {
  const fns = functionsOf(ev).filter((f) => (onlyFunctions ? onlyFunctions.includes(f.id) : !f.private));
  return {
    name: ev.name,
    kind: ev.kind,
    date: ev.date,
    hue: ev.hue,
    functions: fns.map(fn),
    announcements: list(ev, "announcements").slice(-5).reverse(),
    ...(ev.layout !== "empty" && ev.site?.lang ? { lang: ev.site.lang } : {}),
  };
}

/** A helper is anyone whose name appears in a task's "who": "Rohan" sees "Ananya, Rohan". */
export function isHelper(who: string | undefined, name: string): boolean {
  if (!who) return false;
  const want = name.trim().toLowerCase();
  return who
    .toLowerCase()
    .split(/,|&|\band\b|\//)
    .map((s) => s.replace(/\(.*?\)/g, "").trim())
    .some((s) => s === want);
}

/** The text in a household's entry QR. */
export function entryCode(householdId: string): string {
  return `plannr:h:${householdId}`;
}

/** The text in a printed pass's QR. */
export function passCode(passId: string): string {
  return `plannr:p:${passId}`;
}

/** The pass id from a scanned pass QR, if it is one. */
export function readPassCode(text: string): string | undefined {
  return text.match(/^plannr:p:([\w-]{1,80})$/)?.[1];
}

/** The household id from a scanned entry QR, if it is one. */
export function readEntryCode(text: string): string | undefined {
  return text.match(/^plannr:h:([\w-]{1,80})$/)?.[1];
}

type Planned = Exclude<PlannrEvent, { layout: "empty" }>;
type Community = Extract<PlannrEvent, { layout: "community" }>;
type ViewOf<K extends PublicKind> = Extract<PublicView, { kind: K }>;

/** One projector per link kind: the mapped type makes the compiler insist on every one. */
type Projectors = { [K in PublicKind]: (ev: Planned, target: string) => ViewOf<K> | undefined };

/** First names only: the volunteer sheet is for neighbours, not a directory. */
const firstName = (name: string) => name.split(" ")[0] ?? name;

function rsvpView(ev: Planned, target: string): RsvpView | undefined {
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

function siteView(ev: Planned): SiteView | undefined {
  if (!ev.site?.published) return undefined;
  const { published: _published, ...site } = ev.site;
  return { kind: "site", event: basics(ev), site };
}

function helperView(ev: Planned, helper: string): HelperView {
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

function vendorView(ev: Planned, target: string): VendorView | undefined {
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

function shiftsView(ev: Community): ShiftsView {
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

function fundView(ev: Community): FundView {
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

function stallsView(ev: Community): StallsView {
  const { stalls } = fundTotals(ev);
  const stallList = ev.stallList ?? [];
  const fees = stallList.map((s) => s.fee);
  return {
    kind: "stalls",
    event: basics(ev),
    fee: fees.length ? Math.max(...fees) : 0,
    open: Math.max(0, stalls.total - stalls.booked - stalls.requested),
    total: stalls.total,
    categories: [...new Set(stallList.map((s) => s.category).filter((c): c is string => !!c))],
  };
}

function gateView(ev: Community): GateView {
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
const communityOnly =
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

/** Where each link opens. */
export const PUBLIC_PATH: Record<PublicKind, string> = {
  rsvp: "r",
  helper: "h",
  vendor: "v",
  shifts: "s",
  fund: "fund",
  site: "e",
  album: "a",
  stalls: "stalls",
  gate: "gate",
};
