import type { PlannrEvent } from "../data/types";
import { addDays, shortDate } from "../lib/dates";
import { inr } from "../lib/format";
import { functionsOf, list } from "./records";

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

export function remindersFor(ev: PlannrEvent, today: string): Reminder[] {
  if (ev.layout === "empty" || ev.archived || ev.date < addDays(today, -1)) return [];
  const out: Reminder[] = [];
  const tomorrow = addDays(today, 1);
  for (const f of functionsOf(ev)) {
    if (f.date === today)
      out.push({ eventId: ev.id, rank: 0, text: `${f.label} is today${f.time ? ` at ${f.time}` : ""}` });
    else if (f.date === tomorrow) out.push({ eventId: ev.id, rank: 1, text: `${f.label} is tomorrow` });
  }
  for (const p of list(ev, "payments"))
    if (!p.paid && p.date <= addDays(today, 2))
      out.push({
        eventId: ev.id,
        rank: p.date < today ? 2 : 3,
        text: `${p.date < today ? "Overdue" : p.date === today ? "Pay today" : `Pay by ${shortDate(p.date)}`}: ${p.label}, ${inr(p.amount)}`,
      });
  for (const t of ev.tasks.list)
    if (!t.done && t.due <= today && (t.who === "You" || !t.who))
      out.push({
        eventId: ev.id,
        rank: t.due < today ? 4 : 5,
        text: `${t.due < today ? "Overdue" : "Today"}: ${t.title}`,
      });
  return out.sort((a, b) => a.rank - b.rank);
}

/** One notification for the morning, or nothing when the day is clear. */
export function morningMessage(
  events: PlannrEvent[],
  today: string,
): { title: string; body: string; url: string } | undefined {
  const all = events.flatMap((ev) => remindersFor(ev, today).map((r) => ({ ...r, name: ev.name })));
  if (!all.length) return undefined;
  all.sort((a, b) => a.rank - b.rank);
  const events1 = new Set(all.map((r) => r.eventId));
  const only = events1.size === 1 ? all[0]?.name : undefined;
  const title = only ? `Today for ${only}` : `${all.length} things today`;
  const lines = all.slice(0, 3).map((r) => (only ? r.text : `${r.name}: ${r.text}`));
  if (all.length > 3) lines.push(`and ${all.length - 3} more`);
  return { title, body: lines.join("\n"), url: only ? `/events/${all[0]?.eventId}` : "/today" };
}
