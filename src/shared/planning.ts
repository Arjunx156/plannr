import type { Kind, PlannrEvent, Task, Vendor } from "../data/types";
import { addDays, daysBetween } from "../lib/dates";
import { functionsOf, list } from "./records";

/**
 * The two planning views the brief asks for, worked out from the plan itself:
 * a vendor checklist with a book-by date for each vendor, and a timeline that puts
 * tasks, payments, bookings and the functions in one dated sequence.
 */

// ---------------------------------------------------------------- vendor checklist

interface CatalogueEntry {
  category: string;
  /** Words that match this entry in a vendor's category, lower case. */
  match: string[];
  /** How long before the day this vendor is usually booked. */
  leadDays: number;
  why: string;
  /** Only when the event has one of these functions. */
  onlyWith?: string[];
}

/** What each kind of event usually books, and how far ahead. */
const CATALOGUE: Record<Kind, CatalogueEntry[]> = {
  wedding: [
    { category: "Venue", match: ["venue", "hall"], leadDays: 180, why: "Good halls go a season ahead" },
    {
      category: "Catering",
      match: ["cater", "sadhya", "food"],
      leadDays: 150,
      why: "Sets the per-plate cost",
    },
    {
      category: "Photography",
      match: ["photo", "video"],
      leadDays: 150,
      why: "Popular teams fill wedding dates early",
    },
    {
      category: "Attire",
      match: ["attire", "saree", "outfit"],
      leadDays: 120,
      why: "Weaving and fittings take weeks",
    },
    {
      category: "Décor",
      match: ["décor", "decor", "mandapam"],
      leadDays: 90,
      why: "Needs the venue layout first",
    },
    { category: "Makeup & hair", match: ["makeup", "hair"], leadDays: 90, why: "Trials before the day" },
    {
      category: "Music",
      match: ["music", "melam", "dj", "band", "nadaswaram"],
      leadDays: 90,
      why: "Artists travel",
    },
    {
      category: "Invitations",
      match: ["invitation", "card", "print"],
      leadDays: 75,
      why: "Posted six weeks out",
    },
    {
      category: "Priest",
      match: ["priest", "vadhyar", "pandit", "officiant"],
      leadDays: 60,
      why: "Confirms the muhurtham",
    },
    {
      category: "Mehendi artist",
      match: ["mehendi", "henna"],
      leadDays: 45,
      why: "Busy in the season",
      onlyWith: ["mehendi"],
    },
    {
      category: "Guest transport",
      match: ["transport", "bus", "car"],
      leadDays: 30,
      why: "After the guest count settles",
    },
  ],
  birthday: [
    {
      category: "Venue",
      match: ["venue", "hall", "planetarium"],
      leadDays: 30,
      why: "Weekend slots go first",
    },
    { category: "Food", match: ["cater", "snack", "food"], leadDays: 14, why: "Needs the final head count" },
    {
      category: "Décor",
      match: ["décor", "decor", "balloon"],
      leadDays: 14,
      why: "Theme props are made to order",
    },
    {
      category: "Entertainment",
      match: ["entertain", "magic", "show", "games"],
      leadDays: 21,
      why: "Weekend performers book out",
    },
    { category: "Cake", match: ["cake", "bake"], leadDays: 10, why: "Theme cakes need a design" },
    { category: "Return gifts", match: ["gift", "favour"], leadDays: 10, why: "Bulk orders take a week" },
    {
      category: "Photography",
      match: ["photo", "video"],
      leadDays: 14,
      why: "One person free to take pictures",
    },
  ],
  community: [
    {
      category: "Venue and permission",
      match: ["venue", "ground", "hall"],
      leadDays: 90,
      why: "Permits need the venue",
    },
    {
      category: "Sound and lights",
      match: ["sound", "light", "pa "],
      leadDays: 45,
      why: "Licensed by the police",
    },
    {
      category: "Pandal and seating",
      match: ["pandal", "tent", "seating", "chairs"],
      leadDays: 45,
      why: "Shared across festivals",
    },
    {
      category: "Food",
      match: ["cater", "food", "prasad", "sadhya"],
      leadDays: 30,
      why: "Bulk orders and gas cylinders",
    },
    {
      category: "Printing",
      match: ["print", "banner", "poster", "flyer"],
      leadDays: 21,
      why: "Banners go up two weeks out",
    },
    {
      category: "Security and first aid",
      match: ["security", "first aid", "ambulance"],
      leadDays: 21,
      why: "Required for crowds",
    },
    {
      category: "Cleaning",
      match: ["clean", "waste", "sanitation"],
      leadDays: 21,
      why: "Waste must be cleared the same night",
    },
  ],
  other: [
    { category: "Venue", match: ["venue", "hall"], leadDays: 60, why: "Everything follows the venue" },
    { category: "Food", match: ["cater", "food", "snack"], leadDays: 30, why: "Sets the per-plate cost" },
    { category: "Décor", match: ["décor", "decor"], leadDays: 21, why: "After the venue is fixed" },
    { category: "Photography", match: ["photo", "video"], leadDays: 21, why: "Someone to keep the memories" },
  ],
};

/** Lead time for a vendor the catalogue doesn't know. */
const DEFAULT_LEAD = 30;

export type ChecklistState = "booked" | "talking" | "missing";

export interface ChecklistItem {
  category: string;
  state: ChecklistState;
  /** The latest sensible date to have them booked. */
  bookBy: string;
  /** Not booked and past the book-by date. */
  late: boolean;
  why?: string;
  /** The vendor record that covers this item, when there is one. */
  vendorId?: string;
  vendorName?: string;
}

function stateOf(v: Vendor | undefined): ChecklistState {
  if (!v) return "missing";
  if (v.stage === "booked") return "booked";
  return v.stage === "needed" ? "missing" : "talking";
}

/** Prefer the vendor furthest along when several cover the same item. */
const STAGE_RANK = { booked: 3, quoted: 2, enquired: 1, needed: 0 } as const;

function bestOf(vendors: Vendor[]): Vendor | undefined {
  return [...vendors].sort((a, b) => STAGE_RANK[b.stage] - STAGE_RANK[a.stage])[0];
}

/**
 * Every vendor this kind of event usually needs, plus any the family added, each with a
 * book-by date counted back from the event day. Booked items sort last.
 */
export function vendorChecklist(ev: PlannrEvent, today: string): ChecklistItem[] {
  const vendors = list(ev, "vendors");
  const fnIds = functionsOf(ev).map((f) => f.id);
  const entries = CATALOGUE[ev.kind].filter((c) => !c.onlyWith || c.onlyWith.some((f) => fnIds.includes(f)));
  const used = new Set<string>();
  const item = (category: string, leadDays: number, covering: Vendor[], why?: string): ChecklistItem => {
    for (const v of covering) used.add(v.id);
    const v = bestOf(covering);
    const state = stateOf(v);
    const bookBy = addDays(ev.date, -leadDays);
    return {
      category,
      state,
      bookBy,
      late: state !== "booked" && bookBy < today,
      ...(why ? { why } : {}),
      ...(v ? { vendorId: v.id } : {}),
      ...(v?.name ? { vendorName: v.name } : {}),
    };
  };
  const items = entries.map((c) =>
    item(
      c.category,
      c.leadDays,
      vendors.filter((v) => !used.has(v.id) && c.match.some((m) => v.category.toLowerCase().includes(m))),
      c.why,
    ),
  );
  for (const v of vendors) if (!used.has(v.id)) items.push(item(v.category, DEFAULT_LEAD, [v]));
  const order: Record<ChecklistState, number> = { missing: 0, talking: 1, booked: 2 };
  return items.sort((a, b) => order[a.state] - order[b.state] || a.bookBy.localeCompare(b.bookBy));
}

export function checklistProgress(items: ChecklistItem[]): { booked: number; total: number; late: number } {
  return {
    booked: items.filter((i) => i.state === "booked").length,
    total: items.length,
    late: items.filter((i) => i.late).length,
  };
}

// ---------------------------------------------------------------- timeline

export type TimelineKind = "task" | "payment" | "booking" | "function";

export interface TimelineEntry {
  /** Unique within the timeline; the record id for tasks. */
  key: string;
  kind: TimelineKind;
  date: string;
  title: string;
  done: boolean;
  /** Not done and its date has passed. Functions are never late. */
  late: boolean;
  amount?: number;
  refId?: string;
}

export interface TimelinePhase {
  id: "early" | "months" | "month" | "week" | "day" | "after";
  label: string;
  entries: TimelineEntry[];
  /** The phase today falls in. */
  current: boolean;
}

const PHASES: { id: TimelinePhase["id"]; label: string; minDays: number }[] = [
  { id: "early", label: "More than three months before", minDays: 91 },
  { id: "months", label: "One to three months before", minDays: 31 },
  { id: "month", label: "The final month", minDays: 8 },
  { id: "week", label: "The final week", minDays: 1 },
  { id: "day", label: "The day", minDays: 0 },
  { id: "after", label: "After the day", minDays: Number.NEGATIVE_INFINITY },
];

function phaseOf(date: string, eventDate: string, firstDay: string, lastDay: string): TimelinePhase["id"] {
  if (date >= firstDay && date <= lastDay) return "day";
  if (date > lastDay) return "after";
  const before = daysBetween(date, eventDate);
  return PHASES.find((p) => p.id !== "day" && p.id !== "after" && before >= p.minDays)?.id ?? "week";
}

const KIND_ORDER: Record<TimelineKind, number> = { function: 0, booking: 1, payment: 2, task: 3 };

/** A task already on the plan says the same thing, e.g. "Pay venue balance" beside the venue balance. */
function coveredByTask(tasks: Task[], verb: "pay" | "book", subject: string): boolean {
  const stem =
    subject
      .toLowerCase()
      .split(/[\s·&,]+/)[0]
      ?.slice(0, 5) ?? "";
  return (
    stem.length >= 3 &&
    tasks.some(
      (t) => !t.done && t.title.toLowerCase().startsWith(`${verb} `) && t.title.toLowerCase().includes(stem),
    )
  );
}

/** Tasks, unpaid payments, vendors still to book and the functions, grouped by how far out they fall. */
export function buildTimeline(ev: PlannrEvent, today: string): TimelinePhase[] {
  if (ev.layout === "empty") return [];
  const fns = functionsOf(ev);
  const days = fns.map((f) => f.date).sort();
  const firstDay = days[0] ?? ev.date;
  const lastDay = days[days.length - 1] ?? ev.date;
  const tasks = ev.tasks.list;
  const entries: TimelineEntry[] = [
    ...tasks.map((t) => ({
      key: `task:${t.id}`,
      kind: "task" as const,
      date: t.due,
      title: t.title,
      done: t.done,
      late: !t.done && t.due < today,
      refId: t.id,
    })),
    ...list(ev, "payments")
      .filter((p) => p.paid || !coveredByTask(tasks, "pay", p.label))
      .map((p) => ({
        key: `payment:${p.id}`,
        kind: "payment" as const,
        date: p.date,
        title: p.label,
        done: p.paid,
        late: !p.paid && p.date < today,
        amount: p.amount,
        refId: p.id,
      })),
    ...vendorChecklist(ev, today)
      .filter((i) => i.state !== "booked" && !coveredByTask(tasks, "book", i.category))
      .map((i) => ({
        key: `booking:${i.category}`,
        kind: "booking" as const,
        date: i.bookBy,
        title: `Book ${i.category.toLowerCase()}`,
        done: false,
        late: i.late,
        ...(i.vendorId ? { refId: i.vendorId } : {}),
      })),
    ...fns.map((f) => ({
      key: `function:${f.id}`,
      kind: "function" as const,
      date: f.date,
      title: f.label,
      done: f.date < today,
      late: false,
      refId: f.id,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const now = phaseOf(today, ev.date, firstDay, lastDay);
  return PHASES.map((p) => ({
    id: p.id,
    label: p.label,
    entries: entries.filter((e) => phaseOf(e.date, ev.date, firstDay, lastDay) === p.id),
    current: p.id === now,
  })).filter((p) => p.entries.length || p.current);
}
