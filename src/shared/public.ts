import type { FunctionDay, Task } from "../data/baseTypes";
import type { Household } from "../data/guestTypes";
import type { Announcement, Photo, SiteInfo } from "../data/recordTypes";
import type { PlannrEvent } from "../data/types";
import { addDays } from "../lib/dates";
import { functionsOf } from "./eventLists";
import { list } from "./records";

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

/** A function as a shared page shows it: when, where and what to wear. */
export interface PublicFunction {
  id: string;
  label: string;
  date: string;
  time?: string | undefined;
  place?: string | undefined;
  address?: string | undefined;
  dress?: string | undefined;
}

/** What every shared page shows about the event, and nothing more. */
export interface PublicBasics {
  name: string;
  kind: PlannrEvent["kind"];
  date: string;
  hue: PlannrEvent["hue"];
  functions: PublicFunction[];
  announcements: Announcement[];
  /** The family's language for guest pages, e.g. "ml". */
  lang?: string | undefined;
}

/** A household's invitation: its functions, its answers so far and the meal choices. */
export interface RsvpView {
  kind: "rsvp";
  event: PublicBasics;
  household: Pick<
    Household,
    "name" | "expected" | "functions" | "rsvp" | "meal" | "stay" | "pickup" | "note" | "lang"
  >;
  site?: Pick<SiteInfo, "story" | "storyLocal" | "lang"> | undefined;
  /** What the QR at the entrance holds once they've said yes; the hosts scan it on the day. */
  entry?: string | undefined;
}

/** A published event website. */
export interface SiteView {
  kind: "site";
  event: PublicBasics;
  site: Omit<SiteInfo, "published">;
}

/** One helper's tasks, with the contacts they need. */
export interface HelperView {
  kind: "helper";
  event: PublicBasics;
  helper: string;
  tasks: Pick<Task, "id" | "title" | "due" | "done" | "note">[];
  checklist: { id: string; label: string; done: boolean }[];
}

/** One vendor's call sheet: arrival times, contacts and what is needed. */
export interface VendorView {
  kind: "vendor";
  event: PublicBasics;
  vendor: { category: string; name: string; needs?: string | undefined };
  arrivals: {
    label: string;
    date: string;
    time: string;
    place?: string | undefined;
    note?: string | undefined;
  }[];
  runsheet: { label: string; time: string; title: string }[];
  payments: { label: string; amount: number; date: string; paid: boolean }[];
}

/** Open volunteer shifts and who has signed up. */
export interface ShiftsView {
  kind: "shifts";
  event: PublicBasics;
  slots: string[];
  roles: { role: string; slots: { need: number; filled: number; names: string[] }[] }[];
}

/** A community event's money, as residents see it. */
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

/** The shared photo album. */
export interface AlbumView {
  kind: "album";
  event: PublicBasics;
  photos: Photo[];
}

/** The stalls still open, the fee and the request form. */
export interface StallsView {
  kind: "stalls";
  event: PublicBasics;
  fee: number;
  open: number;
  total: number;
  categories: string[];
}

/** The gate volunteer's check-in list. */
export interface GateView {
  kind: "gate";
  event: PublicBasics;
  passes: { id: string; name: string; count: number; checkedIn: number }[];
  issued: number;
  inside: number;
  capacity: number;
}

/** Everything a shared link can show, one shape per kind of link. */
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
