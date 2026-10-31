import type { FunctionDay } from "../data/baseTypes";
import type { Category, Gift, Payment, Settlement } from "../data/budgetTypes";
import type { Approval, FundSource, Pass, Permit, Sponsor, Stall } from "../data/communityTypes";
import type { Household, RoomBlock, SeatTable } from "../data/guestTypes";
import type { Announcement, CheckItem, Idea, MemoryNote, Photo, RunItem } from "../data/recordTypes";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../data/types";
import type { Vendor } from "../data/vendorTypes";
import { functionsOf, slugId, vendorsOf } from "./eventLists";

/**
 * Every list a plan holds, in one place: where it lives on the event, what it holds when an
 * older plan doesn't have it yet, and how its items are named in history.
 */

type Planned = PersonalEvent | CommunityEvent;

export interface RecordTypes {
  households: Household;
  tables: SeatTable;
  rooms: RoomBlock;
  vendors: Vendor;
  payments: Payment;
  categories: Category;
  settlements: Settlement;
  gifts: Gift;
  functions: FunctionDay;
  runsheet: RunItem;
  checklist: CheckItem;
  announcements: Announcement;
  album: Photo;
  memory: MemoryNote;
  ideas: Idea;
  stalls: Stall;
  passes: Pass;
  sponsors: Sponsor;
  permits: Permit & { id: string };
  approvals: Approval;
  sources: FundSource & { id: string };
}

export type Coll = keyof RecordTypes;
export type AnyRecord = RecordTypes[Coll];

interface Store<C extends Coll> {
  /** Layouts that can hold this list. */
  layouts: Planned["layout"][];
  get: (ev: Planned) => RecordTypes[C][];
  set: (ev: Planned, list: RecordTypes[C][]) => Planned;
  /** What history calls one item, e.g. "the household “Menon family”". */
  name: (r: RecordTypes[C]) => string;
}

const both: Planned["layout"][] = ["personal", "community"];
const personalOnly: Planned["layout"][] = ["personal"];
const communityOnly: Planned["layout"][] = ["community"];

const q = (s: string | undefined) => `“${s ?? ""}”`;

/** Gives permits and fund sources stable ids; seed data names them by label only. */
function withIds<T extends { id?: string; label: string }>(list: T[]): (T & { id: string })[] {
  return list.map((x) => ({ ...x, id: x.id ?? slugId(x.label) }));
}

const STORES: { [C in Coll]: Store<C> } = {
  households: {
    layouts: both,
    get: (e) => e.households ?? [],
    set: (e, households) => ({ ...e, households }),
    name: (r) => `the household ${q(r.name)}`,
  },
  tables: {
    layouts: both,
    get: (e) => e.tables ?? [],
    set: (e, tables) => ({ ...e, tables }),
    name: (r) => `table ${q(r.name)}`,
  },
  rooms: {
    layouts: both,
    get: (e) => e.rooms ?? [],
    set: (e, rooms) => ({ ...e, rooms }),
    name: (r) => `the room block at ${r.hotel}`,
  },
  vendors: {
    layouts: both,
    get: (e) => vendorsOf(e),
    set: (e, vendorList) => ({ ...e, vendorList }),
    name: (r) => (r.name ? `${r.name} (${r.category})` : `the ${r.category} vendor`),
  },
  payments: {
    layouts: personalOnly,
    get: (e) => (e.layout === "personal" ? e.budget.payments : []),
    set: (e, payments) => (e.layout === "personal" ? { ...e, budget: { ...e.budget, payments } } : e),
    name: (r) => `the payment ${q(r.label)}`,
  },
  categories: {
    layouts: personalOnly,
    get: (e) => (e.layout === "personal" ? e.budget.categories : []),
    set: (e, categories) => (e.layout === "personal" ? { ...e, budget: { ...e.budget, categories } } : e),
    name: (r) => `the budget line ${q(r.name)}`,
  },
  settlements: {
    layouts: personalOnly,
    get: (e) => (e.layout === "personal" ? (e.budget.split?.settlements ?? []) : []),
    set: (e, settlements) =>
      e.layout === "personal" && e.budget.split
        ? { ...e, budget: { ...e.budget, split: { ...e.budget.split, settlements } } }
        : e,
    name: (r) => `${r.from} settling up with ${r.to}`,
  },
  gifts: {
    layouts: both,
    get: (e) => e.gifts ?? [],
    set: (e, gifts) => ({ ...e, gifts }),
    name: (r) => `the gift from ${r.from}`,
  },
  functions: {
    layouts: both,
    get: (e) => functionsOf(e),
    set: (e, functions) => ({ ...e, functions }),
    name: (r) => `the ${r.label}`,
  },
  runsheet: {
    layouts: both,
    get: (e) => e.runsheet ?? [],
    set: (e, runsheet) => ({ ...e, runsheet }),
    name: (r) => `${q(r.title)} on the run sheet`,
  },
  checklist: {
    layouts: both,
    get: (e) => e.checklist ?? [],
    set: (e, checklist) => ({ ...e, checklist }),
    name: (r) => `${q(r.label)} on the checklist`,
  },
  announcements: {
    layouts: both,
    get: (e) => e.announcements ?? [],
    set: (e, announcements) => ({ ...e, announcements }),
    name: (r) => `the announcement ${q(r.text.length > 48 ? `${r.text.slice(0, 47)}…` : r.text)}`,
  },
  album: {
    layouts: both,
    get: (e) => e.album ?? [],
    set: (e, album) => ({ ...e, album }),
    name: (r) => `a photo from ${r.by}`,
  },
  memory: {
    layouts: both,
    get: (e) => e.memory ?? [],
    set: (e, memory) => ({ ...e, memory }),
    name: (r) => `the note ${q(r.text)}`,
  },
  ideas: {
    layouts: both,
    get: (e) => e.ideas ?? [],
    set: (e, ideas) => ({ ...e, ideas }),
    name: (r) => `the idea ${q(r.title)}`,
  },
  stalls: {
    layouts: communityOnly,
    get: (e) => (e.layout === "community" ? (e.stallList ?? []) : []),
    set: (e, stallList) => (e.layout === "community" ? { ...e, stallList } : e),
    name: (r) => `the stall ${q(r.name)}`,
  },
  passes: {
    layouts: communityOnly,
    get: (e) => (e.layout === "community" ? (e.passList ?? []) : []),
    set: (e, passList) => (e.layout === "community" ? { ...e, passList } : e),
    name: (r) => `the pass for ${r.name}`,
  },
  sponsors: {
    layouts: communityOnly,
    get: (e) => (e.layout === "community" ? (e.sponsors ?? []) : []),
    set: (e, sponsors) => (e.layout === "community" ? { ...e, sponsors } : e),
    name: (r) => `the sponsor ${q(r.name)}`,
  },
  permits: {
    layouts: communityOnly,
    get: (e) => (e.layout === "community" ? withIds(e.permits) : []),
    set: (e, permits) => (e.layout === "community" ? { ...e, permits } : e),
    name: (r) => q(r.label),
  },
  approvals: {
    layouts: communityOnly,
    get: (e) => (e.layout === "community" ? e.funds.approvals : []),
    set: (e, approvals) => (e.layout === "community" ? { ...e, funds: { ...e.funds, approvals } } : e),
    name: (r) => `the expense ${q(r.label)}`,
  },
  sources: {
    layouts: communityOnly,
    get: (e) => (e.layout === "community" ? withIds(e.funds.sources) : []),
    set: (e, sources) => (e.layout === "community" ? { ...e, funds: { ...e.funds, sources } } : e),
    name: (r) => `the fund source ${q(r.label)}`,
  },
};

export const COLLS = Object.keys(STORES) as Coll[];

/** Whether a string names one of the plan's record collections. */
export function isColl(c: unknown): c is Coll {
  return typeof c === "string" && c in STORES;
}

/** Whether this kind of event keeps the given collection (stalls are community-only, and so on). */
export function canHold(ev: PlannrEvent, coll: Coll): ev is Planned {
  return ev.layout !== "empty" && STORES[coll].layouts.includes(ev.layout);
}

/** The list for a collection, with defaults for plans that don't have it yet. */
export function list<C extends Coll>(ev: PlannrEvent, coll: C): RecordTypes[C][] {
  return canHold(ev, coll) ? (STORES[coll] as Store<C>).get(ev) : [];
}

/** One record by id, or undefined. */
export function findRecord<C extends Coll>(ev: PlannrEvent, coll: C, id: string): RecordTypes[C] | undefined {
  return list(ev, coll).find((r) => r.id === id);
}

/** Replaces a collection's list. A store swaps one list only, so the event keeps its layout. */
export function setList<E extends PlannrEvent, C extends Coll>(ev: E, coll: C, next: RecordTypes[C][]): E {
  return canHold(ev, coll) ? ((STORES[coll] as Store<C>).set(ev, next) as E) : ev;
}

/** Adds the record, or replaces the one with the same id. */
export function upsert<E extends PlannrEvent, C extends Coll>(ev: E, coll: C, record: RecordTypes[C]): E {
  const current = list(ev, coll);
  const exists = current.some((r) => r.id === record.id);
  return setList(
    ev,
    coll,
    exists ? current.map((r) => (r.id === record.id ? record : r)) : [...current, record],
  );
}

/** Changes some fields of one record; unknown ids change nothing. The id itself never changes. */
export function patch<E extends PlannrEvent, C extends Coll>(
  ev: E,
  coll: C,
  id: string,
  changes: Partial<RecordTypes[C]>,
): E {
  const current = list(ev, coll);
  if (!current.some((r) => r.id === id)) return ev;
  return setList(
    ev,
    coll,
    current.map((r) => (r.id === id ? ({ ...r, ...changes, id } as RecordTypes[C]) : r)),
  );
}

/** Removes one record; unknown ids change nothing. */
export function remove<E extends PlannrEvent>(ev: E, coll: Coll, id: string): E {
  const current = list(ev, coll);
  if (!current.some((r) => r.id === id)) return ev;
  return setList(
    ev,
    coll,
    current.filter((r) => r.id !== id),
  );
}

/** How history names one record. */
export function recordName(coll: Coll, record: AnyRecord | undefined): string {
  if (!record) return "an item";
  return (STORES[coll] as Store<Coll>).name(record);
}
