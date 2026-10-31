import type { CommunityEvent, PersonalEvent } from "../data/types";
import { addDays, daysBetween, shortDate } from "../lib/dates";
import { inr, plural } from "../lib/format";
import { paymentsDue } from "./balances";
import { duplicateGroups, expectedAt, functionCount, householdState, rsvpSummary } from "./derive";
import { functionsOf } from "./eventLists";
import { list } from "./records";
import { eventPath, ids, type Rule, type Watch, weeksTo, whenText } from "./watchRule";

// ---------------------------------------------------------------- every planned event
/** Vendors start to matter six months out, and are urgent ten weeks out. */
const VENDOR_HORIZON_WEEKS = 26;
const VENDOR_URGENT_WEEKS = 10;
export const overdueTasks: Rule<PersonalEvent | CommunityEvent> = (ev, today) => {
  const overdue = ev.tasks.list.filter((t) => !t.done && t.due < today);
  if (overdue.length === 0) return [];
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
export const vendorsNeeded: Rule<PersonalEvent | CommunityEvent> = (ev, today) => {
  const needed = list(ev, "vendors").filter((v) => v.stage === "needed");
  const weeks = weeksTo(today, ev.date);
  if (needed.length === 0 || weeks > VENDOR_HORIZON_WEEKS) return [];
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
  if (soon.length === 0) return [];
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
  if (list(ev, "households").length === 0 || !total || Math.abs(total - ev.guests) < drift) return [];
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
  if (notSent.length === 0 || !first) return [];
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
  if (waiting.length === 0 || !first || daysBetween(today, first) > REPLY_DAYS) return [];
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
  if (dupes.length === 0) return [];
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
export const PERSONAL_RULES: Rule<PersonalEvent>[] = [
  latePayments,
  paymentsThisWeek,
  overPlan,
  headcountDrift,
  overCapacity,
  invitesNotSent,
  repliesWaiting,
  duplicateHouseholds,
];
