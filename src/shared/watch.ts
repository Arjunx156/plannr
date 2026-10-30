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

export function watchPlan(ev: PlannrEvent, today: string): Watch[] {
  if (ev.layout === "empty" || ev.archived || ev.date < today) return [];
  const out = ev.layout === "personal" ? personal(ev, today) : community(ev, today);
  out.push(...shared(ev, today));
  return out.sort((a, b) => a.rank - b.rank);
}

function shared(ev: PersonalEvent | CommunityEvent, today: string): Watch[] {
  const out: Watch[] = [];
  const base = `/events/${ev.id}`;
  const overdue = ev.tasks.list.filter((t) => !t.done && t.due < today);
  if (overdue.length)
    out.push({
      id: `tasks-overdue:${overdue.length}`,
      tone: "warn",
      label: "Overdue",
      text: `${plural(overdue.length, "task is", "tasks are")} past due, the oldest from ${shortDate(overdue.map((t) => t.due).sort()[0] ?? today)}.`,
      why: overdue
        .slice(0, 3)
        .map((t) => t.title)
        .join(" · "),
      primary: { label: "See the tasks", kind: "go", to: `${base}/timeline` },
      rank: 30,
    });
  const needed = list(ev, "vendors").filter((v) => v.stage === "needed");
  const weeks = weeksTo(today, ev.date);
  if (needed.length && weeks <= 26)
    out.push({
      id: `vendors-needed:${needed.map((v) => v.id).join(",")}`,
      tone: weeks <= 10 ? "warn" : "info",
      label: "Still to book",
      text: `${plural(needed.length, "vendor")} still to find, and the event is ${whenText(today, ev.date)}: ${needed
        .slice(0, 4)
        .map((v) => v.category)
        .join(", ")}.`,
      primary: { label: "Find vendors", kind: "go", to: `${base}/vendors` },
      rank: weeks <= 10 ? 15 : 45,
    });
  return out;
}

function personal(ev: PersonalEvent, today: string): Watch[] {
  const out: Watch[] = [];
  const base = `/events/${ev.id}`;

  const late = paymentsDue(ev, addDays(today, -1));
  if (late.length) {
    const sum = late.reduce((s, p) => s + p.amount, 0);
    out.push({
      id: `pay-late:${late.map((p) => p.id).join(",")}`,
      tone: "warn",
      label: "Payment overdue",
      text:
        late.length === 1
          ? `${late[0]?.label}: ${inr(sum)} was due ${shortDate(late[0]?.date ?? today)}.`
          : `${late.length} payments are overdue, ${inr(sum)} in all.`,
      primary: { label: "Open payments", kind: "go", to: `${base}/budget` },
      rank: 5,
    });
  }
  const soon = paymentsDue(ev, addDays(today, 7)).filter((p) => p.date >= today);
  if (soon.length)
    out.push({
      id: `pay-soon:${soon.map((p) => p.id).join(",")}`,
      tone: "info",
      label: "Due this week",
      text: `${soon
        .map((p) => `${p.label} ${inr(p.amount)} by ${shortDate(p.date)}`)
        .slice(0, 2)
        .join(" · ")}${soon.length > 2 ? ` and ${soon.length - 2} more` : ""}.`,
      primary: { label: "Open payments", kind: "go", to: `${base}/budget` },
      rank: 20,
    });

  const over = ev.budget.categories
    .map((c) => ({ c, by: (c.projected ?? c.planned) - c.planned }))
    .filter((x) => x.by > 0)
    .sort((a, b) => b.by - a.by)[0];
  if (over) {
    const { c, by } = over;
    const projected = c.projected ?? c.planned;
    out.push({
      id: `over:${c.id}:${projected}`,
      tone: "warn",
      label: "Over plan",
      text: `${c.name} is heading for ${inr(projected)} against ${inr(c.planned)} planned, ${Math.round((by / Math.max(1, c.planned)) * 100)}% over.`,
      why: c.items.length
        ? `From: ${c.items
            .map((i) => i.name)
            .slice(0, 2)
            .join(", ")}`
        : undefined,
      primary: { label: "See where to save", kind: "go", to: `${base}/budget` },
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
    });
  }

  const hs = list(ev, "households");
  const summary = rsvpSummary(ev);
  if (hs.length && summary.total && Math.abs(summary.total - ev.guests) >= Math.max(5, ev.guests * 0.04))
    out.push({
      id: `headcount:${summary.total}:${ev.guests}`,
      tone: "ai",
      label: "Waiting for your approval",
      text: `The guest list has ${summary.total} people; the budget plans for ${ev.guests}. Update catering, favours and seating to match?`,
      primary: { label: `Preview planning for ${summary.total}`, kind: "headcount", guests: summary.total },
      rank: 12,
    });

  for (const f of functionsOf(ev)) {
    if (!f.capacity || f.date < today) continue;
    const plan = expectedAt(functionCount(ev, f.id));
    if (plan > f.capacity)
      out.push({
        id: `capacity:${f.id}:${plan}`,
        tone: "warn",
        label: "Over capacity",
        text: `${f.place ?? f.label} seats ${f.capacity}, and about ${plan} are expected at the ${f.label}.`,
        primary: { label: "See the guest list", kind: "go", to: `${base}/guests` },
        rank: 14,
      });
  }

  const first = functionsOf(ev)
    .map((f) => f.date)
    .sort()[0];
  const notSent = hs.filter((h) => householdState(h) === "not-sent");
  if (notSent.length && first && daysBetween(today, first) <= 60)
    out.push({
      id: `invites:${notSent.length}`,
      tone: daysBetween(today, first) <= 30 ? "warn" : "info",
      label: "Invitations",
      text: `${plural(notSent.length, "household hasn't", "households haven't")} been invited yet, and the first function is ${whenText(today, first)}.`,
      primary: { label: "Send invitations", kind: "go", to: `${base}/guests` },
      rank: 25,
    });
  const waiting = hs.filter((h) => householdState(h) === "waiting");
  if (waiting.length && first && daysBetween(today, first) <= 21)
    out.push({
      id: `waiting:${waiting.length}`,
      tone: "info",
      label: "Replies",
      text: `${plural(waiting.length, "household hasn't", "households haven't")} replied yet. Caterers usually want a final count a week before.`,
      primary: { label: "Send reminders", kind: "go", to: `${base}/guests` },
      rank: 28,
    });
  const dupes = duplicateGroups(hs);
  if (dupes.length)
    out.push({
      id: `dupes:${dupes.length}`,
      tone: "info",
      label: "Guest list",
      text: `${plural(dupes.length, "family looks", "families look")} like ${dupes.length === 1 ? "it was" : "they were"} added twice, e.g. ${dupes[0]?.map((h) => h.name).join(" and ")}.`,
      primary: { label: "Review and merge", kind: "go", to: `${base}/guests` },
      rank: 40,
    });
  return out;
}

function community(ev: CommunityEvent, today: string): Watch[] {
  const out: Watch[] = [];
  const base = `/events/${ev.id}`;
  const f = fundTotals(ev);
  const pending = ev.funds.approvals.filter((a) => a.status === "pending");
  if (pending.length)
    out.push({
      id: `approvals:${pending.map((a) => a.id).join(",")}`,
      tone: "warn",
      label: "Waiting for the treasurer",
      text: `${plural(pending.length, "expense claim")} to decide, ${inr(pending.reduce((s, a) => s + a.amount, 0))} in all.`,
      primary: { label: "Review claims", kind: "go", to: `${base}/funds` },
      rank: 8,
    });
  for (const p of list(ev, "permits")) {
    if (p.tone === "ok" || !p.due) continue;
    const d = daysBetween(today, p.due);
    if (d > 21) continue;
    out.push({
      id: `permit:${p.id}:${p.tone}`,
      tone: d < 7 ? "warn" : "info",
      label: d < 0 ? "Permit overdue" : "Permit",
      text: `${p.label}: ${p.status.toLowerCase()}, ${d < 0 ? `was due ${shortDate(p.due)}` : `apply by ${longDate(p.due)}`}.`,
      primary: { label: p.letter ? "Open the letter" : "Draft the letter", kind: "go", to: `${base}/funds` },
      rank: d < 7 ? 6 : 22,
    });
  }
  const gaps = ev.shifts.roles.reduce(
    (s, r) => s + r.slots.reduce((t, x) => t + Math.max(0, x.need - x.names.length), 0),
    0,
  );
  if (gaps && daysBetween(today, ev.date) <= 30)
    out.push({
      id: `shifts:${gaps}`,
      tone: daysBetween(today, ev.date) <= 10 ? "warn" : "info",
      label: "Volunteers",
      text: `${plural(gaps, "shift place")} still open, and the event is ${whenText(today, ev.date)}.`,
      primary: { label: "Share the sign-up sheet", kind: "go", to: `${base}/volunteers` },
      rank: 18,
    });
  if (f.stalls.requested)
    out.push({
      id: `stalls:${f.stalls.requested}`,
      tone: "info",
      label: "Stall requests",
      text: `${plural(f.stalls.requested, "stall request")} waiting for a yes or no.`,
      primary: { label: "Decide", kind: "go", to: `${base}/stalls` },
      rank: 24,
    });
  if (f.spent > f.received)
    out.push({
      id: `cash:${f.spent}:${f.received}`,
      tone: "warn",
      label: "Cash",
      text: `${inr(f.spent - f.received)} more has been spent than collected so far.`,
      primary: { label: "See the funds", kind: "go", to: `${base}/funds` },
      rank: 9,
    });
  return out;
}

// ---------------------------------------------------------------- weather

/** Rain likely on a function day in the next ten days: worth a plan B. */
export interface RainRisk {
  fnId: string;
  label: string;
  date: string;
  chance: number;
}

export function rainWatch(ev: PlannrEvent, risks: RainRisk[]): Watch[] {
  return risks
    .filter((r) => r.chance >= 60)
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
