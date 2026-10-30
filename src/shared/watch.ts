import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../data/types";
import { addDays, daysBetween, longDate, shortDate } from "../lib/dates";
import { inr, plural } from "../lib/format";
import {
  duplicateGroups,
  expectedAt,
  functionCount,
  fundTotals,
  householdState,
  paymentsDue,
  rsvpSummary,
} from "./derive";
import type { EventAction } from "./engine";
import { functionsOf, list } from "./records";

/**
 * What needs the planner's attention, worked out from the plan each time it's opened.
 * Every line quotes the plan's own numbers, and every button does something real: it
 * opens the right page, previews a change, or makes one the planner can undo.
 */

export type WatchAction =
  | { label: string; kind: "go"; to: string }
  | { label: string; kind: "headcount"; guests: number }
  | { label: string; kind: "apply"; actions: EventAction[]; done: string };

export interface Watch {
  /** Changes when the situation does, so a dismissed notice comes back if it gets worse. */
  id: string;
  tone: "warn" | "ai" | "info";
  label: string;
  text: string;
  why?: string;
  primary?: WatchAction;
  secondary?: WatchAction;
  /** Lower is more urgent. */
  rank: number;
}

const weeksTo = (today: string, date: string) => Math.max(0, Math.round(daysBetween(today, date) / 7));
const whenText = (today: string, date: string) => {
  const d = daysBetween(today, date);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 14) return `in ${d} days`;
  return `in ${weeksTo(today, date)} weeks`;
};

/** One kind of notice: what it finds in the plan, or nothing. */
type Rule<E> = (ev: E, today: string) => Watch[];

const eventPath = (ev: PlannrEvent, tab: string) => `/events/${ev.id}/${tab}`;
const ids = (items: { id?: string }[]) => items.map((x) => x.id).join(",");

// ---------------------------------------------------------------- every planned event

/** Vendors start to matter six months out, and are urgent ten weeks out. */
const VENDOR_HORIZON_WEEKS = 26;
const VENDOR_URGENT_WEEKS = 10;

const overdueTasks: Rule<PersonalEvent | CommunityEvent> = (ev, today) => {
  const overdue = ev.tasks.list.filter((t) => !t.done && t.due < today);
  if (!overdue.length) return [];
  const oldest = overdue.map((t) => t.due).sort()[0] ?? today;
  return [
    {
      id: `tasks-overdue:${overdue.length}`,
      tone: "warn",
      label: "Overdue",
      text: `${plural(overdue.length, "task is", "tasks are")} past due, the oldest from ${shortDate(oldest)}.`,
      why: overdue
        .slice(0, 3)
        .map((t) => t.title)
        .join(" · "),
      primary: { label: "See the tasks", kind: "go", to: eventPath(ev, "timeline") },
      rank: 30,
    },
  ];
};

const vendorsNeeded: Rule<PersonalEvent | CommunityEvent> = (ev, today) => {
  const needed = list(ev, "vendors").filter((v) => v.stage === "needed");
  const weeks = weeksTo(today, ev.date);
  if (!needed.length || weeks > VENDOR_HORIZON_WEEKS) return [];
  const urgent = weeks <= VENDOR_URGENT_WEEKS;
  const categories = needed
    .slice(0, 4)
    .map((v) => v.category)
    .join(", ");
  return [
    {
      id: `vendors-needed:${ids(needed)}`,
      tone: urgent ? "warn" : "info",
      label: "Still to book",
      text: `${plural(needed.length, "vendor")} still to find, and the event is ${whenText(today, ev.date)}: ${categories}.`,
      primary: { label: "Find vendors", kind: "go", to: eventPath(ev, "vendors") },
      rank: urgent ? 15 : 45,
    },
  ];
};

// ---------------------------------------------------------------- weddings and birthdays

/** Days ahead the "due this week" notice looks. */
const PAYMENT_WEEK = 7;
/** A guest list this far from the budget's headcount (at least 5, or 4%) is worth re-planning for. */
const HEADCOUNT_DRIFT = { min: 5, share: 0.04 };
/** Invitations matter two months before the first function, and are urgent one month before. */
const INVITE_DAYS = { notice: 60, urgent: 30 };
/** Caterers want a final count about three weeks out. */
const REPLY_DAYS = 21;

const latePayments: Rule<PersonalEvent> = (ev, today) => {
  const late = paymentsDue(ev, addDays(today, -1));
  const [first] = late;
  if (!first) return [];
  const sum = late.reduce((s, p) => s + p.amount, 0);
  const text =
    late.length === 1
      ? `${first.label}: ${inr(sum)} was due ${shortDate(first.date)}.`
      : `${late.length} payments are overdue, ${inr(sum)} in all.`;
  return [
    {
      id: `pay-late:${ids(late)}`,
      tone: "warn",
      label: "Payment overdue",
      text,
      primary: { label: "Open payments", kind: "go", to: eventPath(ev, "budget") },
      rank: 5,
    },
  ];
};

const paymentsThisWeek: Rule<PersonalEvent> = (ev, today) => {
  const soon = paymentsDue(ev, addDays(today, PAYMENT_WEEK)).filter((p) => p.date >= today);
  if (!soon.length) return [];
  const named = soon
    .slice(0, 2)
    .map((p) => `${p.label} ${inr(p.amount)} by ${shortDate(p.date)}`)
    .join(" · ");
  const more = soon.length > 2 ? ` and ${soon.length - 2} more` : "";
  return [
    {
      id: `pay-soon:${ids(soon)}`,
      tone: "info",
      label: "Due this week",
      text: `${named}${more}.`,
      primary: { label: "Open payments", kind: "go", to: eventPath(ev, "budget") },
      rank: 20,
    },
  ];
};

/** The category furthest over its plan, with a one-tap way to accept the new figure. */
const overPlan: Rule<PersonalEvent> = (ev) => {
  const worst = ev.budget.categories
    .map((c) => ({ c, by: (c.projected ?? c.planned) - c.planned }))
    .filter((x) => x.by > 0)
    .sort((a, b) => b.by - a.by)[0];
  if (!worst) return [];
  const { c, by } = worst;
  const projected = c.projected ?? c.planned;
  const percent = Math.round((by / Math.max(1, c.planned)) * 100);
  const from = c.items
    .slice(0, 2)
    .map((i) => i.name)
    .join(", ");
  return [
    {
      id: `over:${c.id}:${projected}`,
      tone: "warn",
      label: "Over plan",
      text: `${c.name} is heading for ${inr(projected)} against ${inr(c.planned)} planned, ${percent}% over.`,
      why: from ? `From: ${from}` : undefined,
      primary: { label: "See where to save", kind: "go", to: eventPath(ev, "budget") },
      secondary: {
        label: `Make ${inr(projected)} the plan`,
        kind: "apply",
        actions: [
          {
            type: "updateRecord",
            eventId: ev.id,
            coll: "categories",
            id: c.id,
            patch: { planned: projected },
          },
        ],
        done: `${c.name} is now planned at ${inr(projected)}.`,
      },
      rank: 10,
    },
  ];
};

const headcountDrift: Rule<PersonalEvent> = (ev) => {
  const { total } = rsvpSummary(ev);
  const drift = Math.max(HEADCOUNT_DRIFT.min, ev.guests * HEADCOUNT_DRIFT.share);
  if (!list(ev, "households").length || !total || Math.abs(total - ev.guests) < drift) return [];
  return [
    {
      id: `headcount:${total}:${ev.guests}`,
      tone: "ai",
      label: "Waiting for your approval",
      text: `The guest list has ${total} people; the budget plans for ${ev.guests}. Update catering, favours and seating to match?`,
      primary: { label: `Preview planning for ${total}`, kind: "headcount", guests: total },
      rank: 12,
    },
  ];
};

const overCapacity: Rule<PersonalEvent> = (ev, today) =>
  functionsOf(ev).flatMap((f): Watch[] => {
    if (!f.capacity || f.date < today) return [];
    const plan = expectedAt(functionCount(ev, f.id));
    if (plan <= f.capacity) return [];
    return [
      {
        id: `capacity:${f.id}:${plan}`,
        tone: "warn",
        label: "Over capacity",
        text: `${f.place ?? f.label} seats ${f.capacity}, and about ${plan} are expected at the ${f.label}.`,
        primary: { label: "See the guest list", kind: "go", to: eventPath(ev, "guests") },
        rank: 14,
      },
    ];
  });

/** The date of the event's first function, if it has any. */
function firstFunctionDate(ev: PersonalEvent): string | undefined {
  return functionsOf(ev)
    .map((f) => f.date)
    .sort()[0];
}

const invitesNotSent: Rule<PersonalEvent> = (ev, today) => {
  const notSent = list(ev, "households").filter((h) => householdState(h) === "not-sent");
  const first = firstFunctionDate(ev);
  if (!notSent.length || !first) return [];
  const days = daysBetween(today, first);
  if (days > INVITE_DAYS.notice) return [];
  return [
    {
      id: `invites:${notSent.length}`,
      tone: days <= INVITE_DAYS.urgent ? "warn" : "info",
      label: "Invitations",
      text: `${plural(notSent.length, "household hasn't", "households haven't")} been invited yet, and the first function is ${whenText(today, first)}.`,
      primary: { label: "Send invitations", kind: "go", to: eventPath(ev, "guests") },
      rank: 25,
    },
  ];
};

const repliesWaiting: Rule<PersonalEvent> = (ev, today) => {
  const waiting = list(ev, "households").filter((h) => householdState(h) === "waiting");
  const first = firstFunctionDate(ev);
  if (!waiting.length || !first || daysBetween(today, first) > REPLY_DAYS) return [];
  return [
    {
      id: `waiting:${waiting.length}`,
      tone: "info",
      label: "Replies",
      text: `${plural(waiting.length, "household hasn't", "households haven't")} replied yet. Caterers usually want a final count a week before.`,
      primary: { label: "Send reminders", kind: "go", to: eventPath(ev, "guests") },
      rank: 28,
    },
  ];
};

const duplicateHouseholds: Rule<PersonalEvent> = (ev) => {
  const dupes = duplicateGroups(list(ev, "households"));
  if (!dupes.length) return [];
  const example = dupes[0]?.map((h) => h.name).join(" and ");
  const added = dupes.length === 1 ? "it was" : "they were";
  return [
    {
      id: `dupes:${dupes.length}`,
      tone: "info",
      label: "Guest list",
      text: `${plural(dupes.length, "family looks", "families look")} like ${added} added twice, e.g. ${example}.`,
      primary: { label: "Review and merge", kind: "go", to: eventPath(ev, "guests") },
      rank: 40,
    },
  ];
};

const PERSONAL_RULES: Rule<PersonalEvent>[] = [
  latePayments,
  paymentsThisWeek,
  overPlan,
  headcountDrift,
  overCapacity,
  invitesNotSent,
  repliesWaiting,
  duplicateHouseholds,
];

// ---------------------------------------------------------------- community events

/** Permits show three weeks before they're due, and turn urgent in the last week. */
const PERMIT_DAYS = { notice: 21, urgent: 7 };
/** Open volunteer places show a month out, and turn urgent ten days out. */
const SHIFT_DAYS = { notice: 30, urgent: 10 };

const pendingApprovals: Rule<CommunityEvent> = (ev) => {
  const pending = ev.funds.approvals.filter((a) => a.status === "pending");
  if (!pending.length) return [];
  const sum = pending.reduce((s, a) => s + a.amount, 0);
  return [
    {
      id: `approvals:${ids(pending)}`,
      tone: "warn",
      label: "Waiting for the treasurer",
      text: `${plural(pending.length, "expense claim")} to decide, ${inr(sum)} in all.`,
      primary: { label: "Review claims", kind: "go", to: eventPath(ev, "funds") },
      rank: 8,
    },
  ];
};

const permitsDue: Rule<CommunityEvent> = (ev, today) =>
  list(ev, "permits").flatMap((p): Watch[] => {
    if (p.tone === "ok" || !p.due) return [];
    const d = daysBetween(today, p.due);
    if (d > PERMIT_DAYS.notice) return [];
    const urgent = d < PERMIT_DAYS.urgent;
    const when = d < 0 ? `was due ${shortDate(p.due)}` : `apply by ${longDate(p.due)}`;
    return [
      {
        id: `permit:${p.id}:${p.tone}`,
        tone: urgent ? "warn" : "info",
        label: d < 0 ? "Permit overdue" : "Permit",
        text: `${p.label}: ${p.status.toLowerCase()}, ${when}.`,
        primary: {
          label: p.letter ? "Open the letter" : "Draft the letter",
          kind: "go",
          to: eventPath(ev, "funds"),
        },
        rank: urgent ? 6 : 22,
      },
    ];
  });

const openShifts: Rule<CommunityEvent> = (ev, today) => {
  const gaps = ev.shifts.roles
    .flatMap((r) => r.slots)
    .reduce((sum, slot) => sum + Math.max(0, slot.need - slot.names.length), 0);
  const days = daysBetween(today, ev.date);
  if (!gaps || days > SHIFT_DAYS.notice) return [];
  return [
    {
      id: `shifts:${gaps}`,
      tone: days <= SHIFT_DAYS.urgent ? "warn" : "info",
      label: "Volunteers",
      text: `${plural(gaps, "shift place")} still open, and the event is ${whenText(today, ev.date)}.`,
      primary: { label: "Share the sign-up sheet", kind: "go", to: eventPath(ev, "volunteers") },
      rank: 18,
    },
  ];
};

const stallRequests: Rule<CommunityEvent> = (ev) => {
  const { requested } = fundTotals(ev).stalls;
  if (!requested) return [];
  return [
    {
      id: `stalls:${requested}`,
      tone: "info",
      label: "Stall requests",
      text: `${plural(requested, "stall request")} waiting for a yes or no.`,
      primary: { label: "Decide", kind: "go", to: eventPath(ev, "stalls") },
      rank: 24,
    },
  ];
};

const cashShort: Rule<CommunityEvent> = (ev) => {
  const { spent, received } = fundTotals(ev);
  if (spent <= received) return [];
  return [
    {
      id: `cash:${spent}:${received}`,
      tone: "warn",
      label: "Cash",
      text: `${inr(spent - received)} more has been spent than collected so far.`,
      primary: { label: "See the funds", kind: "go", to: eventPath(ev, "funds") },
      rank: 9,
    },
  ];
};

const COMMUNITY_RULES: Rule<CommunityEvent>[] = [
  pendingApprovals,
  permitsDue,
  openShifts,
  stallRequests,
  cashShort,
];
const SHARED_RULES: Rule<PersonalEvent | CommunityEvent>[] = [overdueTasks, vendorsNeeded];

/** Everything worth the planner's attention in one upcoming event, most urgent first. */
export function watchPlan(ev: PlannrEvent, today: string): Watch[] {
  if (ev.layout === "empty" || ev.archived || ev.date < today) return [];
  const own =
    ev.layout === "personal"
      ? PERSONAL_RULES.flatMap((rule) => rule(ev, today))
      : COMMUNITY_RULES.flatMap((rule) => rule(ev, today));
  const shared = SHARED_RULES.flatMap((rule) => rule(ev, today));
  return [...own, ...shared].sort((a, b) => a.rank - b.rank);
}

// ---------------------------------------------------------------- weather

/** Rain likely on a function day in the next ten days: worth a plan B. */
export interface RainRisk {
  fnId: string;
  label: string;
  date: string;
  chance: number;
}

/** Forecast chance of rain (percent) worth planning around. */
const RAIN_CHANCE = 60;

/** A notice, with a one-tap checklist item, for each function day where rain is likely. */
export function rainWatch(ev: PlannrEvent, risks: RainRisk[]): Watch[] {
  return risks
    .filter((r) => r.chance >= RAIN_CHANCE)
    .map((r) => ({
      id: `rain:${r.fnId}:${r.date}`,
      tone: "warn" as const,
      label: "Weather",
      text: `Rain is likely on ${longDate(r.date)}, the day of the ${r.label}: ${r.chance}% chance in the forecast.`,
      why: "Forecast from Open-Meteo for the venue's area.",
      primary: {
        label: "Add rain cover to the checklist",
        kind: "apply" as const,
        actions: [
          {
            type: "addRecord" as const,
            eventId: ev.id,
            coll: "checklist" as const,
            record: {
              id: `rain-${r.fnId}-${r.date}`,
              fnId: r.fnId,
              label: `Rain cover and umbrellas for the ${r.label}`,
              done: false,
            },
          },
        ],
        done: "Added to the day's checklist.",
      },
      rank: 4,
    }));
}
