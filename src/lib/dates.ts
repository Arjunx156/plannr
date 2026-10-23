/**
 * The demo story was written on Sunday 27 Sep 2026. Demo data is moved forward in
 * whole weeks so it always starts from today, with weekdays intact.
 */
export const STORY_DAY = "2026-09-27";

/** Today's local date. Live binding: tests and the journey suite pin it with setToday. */
export let TODAY = toISO(new Date());

export function setToday(iso: string): void {
  TODAY = iso;
}

/** Days to move the demo story so its "today" lands within three days of the real one. */
export function demoShift(today = TODAY): number {
  return Math.round(daysBetween(STORY_DAY, today) / 7) * 7;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Parse YYYY-MM-DD as a local calendar date (no timezone drift). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function daysBetween(fromISO: string, toISO_: string): number {
  const ms = parseDate(toISO_).getTime() - parseDate(fromISO).getTime();
  return Math.round(ms / 86400000);
}

export function daysUntil(iso: string): number {
  return daysBetween(TODAY, iso);
}

/** "Sun 25 Apr 2027" */
export function longDate(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Saturday 7 November 2026", for letters. */
export function fullDate(iso: string): string {
  const d = parseDate(iso);
  const day = d.toLocaleString("en-IN", { weekday: "long" });
  const month = d.toLocaleString("en-IN", { month: "long" });
  return `${day} ${d.getDate()} ${month} ${d.getFullYear()}`;
}

/** "5 Oct" */
export function dayMonth(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "October" */
export function monthName(iso: string): string {
  return parseDate(iso).toLocaleString("en-IN", { month: "long" });
}

/** "22–25 Apr 2027", "29 Apr–2 May 2027", "30 Dec 2026–2 Jan 2027" */
export function dateRange(from: string, to: string): string {
  const a = parseDate(from);
  const b = parseDate(to);
  const end = `${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${plainDate(from)}–${end}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTHS[a.getMonth()]}–${end}`;
  return `${a.getDate()}–${end}`;
}

/** The Friday on or before a date. */
export function fridayOnOrBefore(iso: string): string {
  const day = parseDate(iso).getDay();
  return addDays(iso, -((day - 5 + 7) % 7));
}

/** "Mon 5 Oct" */
export function shortDate(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Tue 29" */
export function dayLabel(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

/** "5 OCT" */
export function stamp(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.toUpperCase()}`;
}

/** "21 Sep 2026" */
export function plainDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthYear(iso: string): string {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthShort(iso: string): string {
  return MONTHS[parseDate(iso).getMonth()] ?? "";
}

/** Relative due label for task lists: "3 days late", "Today", "Tue 29". */
export function dueLabel(iso: string): { text: string; late: boolean } {
  const n = daysUntil(iso);
  if (n < 0) return { text: `${-n} ${n === -1 ? "day" : "days"} late`, late: true };
  if (n === 0) return { text: "Today", late: false };
  if (n < 7) return { text: dayLabel(iso), late: false };
  return { text: shortDate(iso), late: false };
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
