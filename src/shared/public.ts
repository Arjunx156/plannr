import type { Announcement, FunctionDay, Household, Photo, PlannrEvent, SiteInfo, Task } from "../data/types";
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

/** The household id from a scanned entry QR, if it is one. */
export function readEntryCode(text: string): string | undefined {
  return text.match(/^plannr:h:([\w-]{1,80})$/)?.[1];
}

/** The view for one link, or undefined when its target is gone from the plan. */
export function projectView(ev: PlannrEvent, kind: PublicKind, target: string): PublicView | undefined {
  if (ev.layout === "empty") return undefined;
  switch (kind) {
    case "rsvp": {
      const h = list(ev, "households").find((x) => x.id === target);
      if (!h) return undefined;
      return {
        kind,
        event: basics(ev, h.functions),
        household: {
          name: h.name,
          expected: h.expected,
          functions: h.functions,
          rsvp: h.rsvp,
          meal: h.meal,
          stay: h.stay,
          pickup: h.pickup,
          note: h.note,
          lang: h.lang,
        },
        site: ev.site
          ? { story: ev.site.story, storyLocal: ev.site.storyLocal, lang: ev.site.lang }
          : undefined,
        entry: Object.values(h.rsvp).some((a) => a.status === "yes") ? entryCode(h.id) : undefined,
      };
    }
    case "site": {
      if (!ev.site?.published) return undefined;
      const { published: _p, ...site } = ev.site;
      return { kind, event: basics(ev), site };
    }
    case "helper":
      return {
        kind,
        event: basics(ev),
        helper: target,
        tasks: ev.tasks.list
          .filter((t) => isHelper(t.who, target))
          .sort((a, b) => a.due.localeCompare(b.due))
          .map(({ id, title, due, done, note }) => ({ id, title, due, done, note })),
        checklist: list(ev, "checklist")
          .filter((c) => isHelper(c.owner, target))
          .map(({ id, label, done }) => ({ id, label, done })),
      };
    case "vendor": {
      const v = vendorsOf(ev).find((x) => x.id === target);
      if (!v) return undefined;
      const fns = functionsOf(ev);
      const names = [v.name, v.contact].filter(Boolean).map((s) => (s ?? "").toLowerCase());
      return {
        kind,
        event: basics(
          ev,
          (v.arrivals ?? []).map((a) => a.fnId),
        ),
        vendor: { category: v.category, name: v.name, needs: v.needs },
        arrivals: (v.arrivals ?? []).flatMap((a) => {
          const f = fns.find((x) => x.id === a.fnId);
          return f
            ? [{ label: f.label, date: f.date, time: clock(a.time), place: f.place, note: a.note }]
            : [];
        }),
        runsheet: fns.flatMap((f) =>
          runsheetFor(ev, f.id)
            .filter((r) =>
              names.some((n) => n && (r.owner ?? "").toLowerCase().includes(n.split(" ")[0] ?? n)),
            )
            .map((r) => ({ label: f.label, time: clock(r.time), title: r.title })),
        ),
        payments: list(ev, "payments")
          .filter((p) => p.vendorId === v.id)
          .map(({ label, amount, date, paid }) => ({ label, amount, date, paid })),
      };
    }
    case "shifts":
      if (ev.layout !== "community") return undefined;
      return {
        kind,
        event: basics(ev),
        slots: ev.shifts.slots,
        roles: ev.shifts.roles.map((r) => ({
          role: r.role,
          // First names only: the sign-up sheet is for neighbours, not a directory.
          slots: r.slots.map((s) => ({
            need: s.need,
            filled: s.names.length,
            names: s.names.map((n) => n.split(" ")[0] ?? n),
          })),
        })),
      };
    case "fund": {
      if (ev.layout !== "community") return undefined;
      const f = fundTotals(ev);
      const pending = ev.funds.approvals.filter((a) => a.status === "pending");
      return {
        kind,
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
    case "album":
      return { kind, event: basics(ev), photos: list(ev, "album").slice().reverse() };
    case "stalls": {
      if (ev.layout !== "community") return undefined;
      const f = fundTotals(ev);
      const fees = (ev.stallList ?? []).map((s) => s.fee);
      return {
        kind,
        event: basics(ev),
        fee: fees.length ? Math.max(...fees) : 0,
        open: Math.max(0, f.stalls.total - f.stalls.booked - f.stalls.requested),
        total: f.stalls.total,
        categories: [...new Set((ev.stallList ?? []).map((s) => s.category).filter((c): c is string => !!c))],
      };
    }
    case "gate": {
      if (ev.layout !== "community") return undefined;
      const f = fundTotals(ev);
      return {
        kind,
        event: basics(ev),
        passes: (ev.passList ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          count: p.count,
          checkedIn: p.checkedIn ?? 0,
        })),
        issued: f.passes.issued,
        inside: f.passes.checkedIn,
        capacity: f.passes.capacity,
      };
    }
  }
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
