import type { PlannrEvent } from "../data/types";
import { addDays, shortDate } from "../lib/dates";
import { inr } from "../lib/format";
import { functionsOf } from "./eventLists";
import { list } from "./records";

/**
 * The morning reminder: what needs doing today across someone's events. Worked out from
 * the plans themselves, so it's never a canned message: overdue and due tasks, payments
 * due in the next two days, and functions happening today or tomorrow.
 */
export interface Reminder {
  eventId: string;
  text: string;
  /** Lower comes first. */
  rank: number;
}

/** Payments due within this many days make the morning list. */
const PAYMENT_LOOKAHEAD_DAYS = 2;
/** Most reminders one notification spells out before "and N more". */
const SHOWN_IN_NOTIFICATION = 3;

type Planned = Exclude<PlannrEvent, { layout: "empty" }>;

/** Functions happening today or tomorrow. */
function functionReminders(ev: Planned, today: string): Reminder[] {
  const tomorrow = addDays(today, 1);
  return functionsOf(ev).flatMap((f) => {
    if (f.date === today)
      return [{ eventId: ev.id, rank: 0, text: `${f.label} is today${f.time ? ` at ${f.time}` : ""}` }];
    if (f.date === tomorrow) return [{ eventId: ev.id, rank: 1, text: `${f.label} is tomorrow` }];
    return [];
  });
}

/** "Overdue", "Pay today" or "Pay by 12 Oct". */
function paymentWhen(date: string, today: string): string {
  if (date < today) return "Overdue";
  if (date === today) return "Pay today";
  return `Pay by ${shortDate(date)}`;
}

/** Unpaid payments that are overdue or due in the next two days. */
function paymentReminders(ev: Planned, today: string): Reminder[] {
  const horizon = addDays(today, PAYMENT_LOOKAHEAD_DAYS);
  return list(ev, "payments")
    .filter((p) => !p.paid && p.date <= horizon)
    .map((p) => ({
      eventId: ev.id,
      rank: p.date < today ? 2 : 3,
      text: `${paymentWhen(p.date, today)}: ${p.label}, ${inr(p.amount)}`,
    }));
}

/** The planner's own tasks that are overdue or due today. */
function taskReminders(ev: Planned, today: string): Reminder[] {
  return ev.tasks.list
    .filter((t) => !t.done && t.due <= today && (t.who === "You" || !t.who))
    .map((t) => ({
      eventId: ev.id,
      rank: t.due < today ? 4 : 5,
      text: `${t.due < today ? "Overdue" : "Today"}: ${t.title}`,
    }));
}

/** Everything that needs doing today for one event, most urgent first. Past and archived events have none. */
export function remindersFor(ev: PlannrEvent, today: string): Reminder[] {
  if (ev.layout === "empty" || ev.archived || ev.date < addDays(today, -1)) return [];
  return [...functionReminders(ev, today), ...paymentReminders(ev, today), ...taskReminders(ev, today)].sort(
    (a, b) => a.rank - b.rank,
  );
}

/** One notification for the morning, or nothing when the day is clear. */
export function morningMessage(
  events: PlannrEvent[],
  today: string,
): { title: string; body: string; url: string } | undefined {
  const all = events.flatMap((ev) => remindersFor(ev, today).map((r) => ({ ...r, name: ev.name })));
  if (all.length === 0) return undefined;
  all.sort((a, b) => a.rank - b.rank);
  const eventIds = new Set(all.map((r) => r.eventId));
  const only = eventIds.size === 1 ? all[0]?.name : undefined;
  const title = only ? `Today for ${only}` : `${all.length} things today`;
  const lines = all.slice(0, SHOWN_IN_NOTIFICATION).map((r) => (only ? r.text : `${r.name}: ${r.text}`));
  if (all.length > SHOWN_IN_NOTIFICATION) lines.push(`and ${all.length - SHOWN_IN_NOTIFICATION} more`);
  return { title, body: lines.join("\n"), url: only ? `/events/${all[0]?.eventId}` : "/today" };
}
