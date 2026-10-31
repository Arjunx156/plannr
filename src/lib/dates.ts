/** One minute, in milliseconds. */
export const MINUTE_MS = 60_000;
/** One hour, in milliseconds. */
export const HOUR_MS: number = 60 * MINUTE_MS;
/** One day, in milliseconds. */
export const DAY_MS: number = 24 * HOUR_MS;

/**
 * The demo story was written on Sunday 27 Sep 2026. Demo data is moved forward in
 * whole weeks so it always starts from today, with weekdays intact.
 */
export const STORY_DAY = "2026-09-27";

/** Today's local date. Live binding: tests and the journey suite pin it with setToday. */
// biome-ignore lint/style/useNamingConvention: read everywhere as a constant; only setToday moves it.
export let TODAY: string = toISO(new Date());

/** Pins "today" to a date, so tests and the journey suite see the same calendar on any day. */
export function setToday(iso: string): void {
  TODAY = iso;
}

/** Days to move the demo story so its "today" lands within three days of the real one. */
export function demoShift(today: string = TODAY): number {
  return Math.round(daysBetween(STORY_DAY, today) / 7) * 7;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The months in lower case, for reading dates out of what people type. */
export const MONTH_NAMES: string[] = [
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a string is a calendar date the way Plannr stores them: YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
  return ISO_DATE.test(s);
}

/** Parse YYYY-MM-DD as a local calendar date (no timezone drift). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** A date as YYYY-MM-DD in local time. */
export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The calendar date `days` after (or before, when negative) the given one. */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole days from one date to another; negative when the second is earlier. */
export function daysBetween(fromISO: string, toISO_: string): number {
  const ms = parseDate(toISO_).getTime() - parseDate(fromISO).getTime();
  return Math.round(ms / DAY_MS);
}

/** Whole days from today until a date. */
export function daysUntil(iso: string): number {
  return daysBetween(TODAY, iso);
}

/** "Sun 25 Apr 2027" */
export function longDate(iso: string): string {
  const d = parseDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Sun 25 Apr 2027 · 7 PM · Lotus Lawns": the day, then whichever details are known. */
export function dayLine(iso: string, ...details: (string | false | undefined)[]): string {
  return [longDate(iso), ...details].filter(Boolean).join(" · ");
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

/** "22–25 Apr 2027", "29 Apr–2 May 2027", "30 Dec 2026–2 Jan 2027", or "30 May 2027" for one day */
export function dateRange(from: string, to: string): string {
  const a = parseDate(from);
  const b = parseDate(to);
  const end = `${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  if (from === to) return end;
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

/** "Apr 2027". */
export function monthYear(iso: string): string {
  const d = parseDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Apr". */
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

/** Good morning, afternoon or evening, by the hour. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
