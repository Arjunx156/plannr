import { addDays, longDate, MONTH_NAMES, parseDate, TODAY, toISO } from "./dates";
import { cap, toNumber } from "./intakeWords";

export const MONTH_RE =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
type DateGuess = { date: string; label: string };
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };
/** Where a cue puts the date in its month, and how the label says it. No cue means mid-month. */
const MONTH_PART: Record<string, { day: number; prefix: string }> = {
  "end of": { day: 25, prefix: "Late " },
  late: { day: 25, prefix: "Late " },
  mid: { day: 15, prefix: "Mid " },
  early: { day: 5, prefix: "Early " },
  "start of": { day: 5, prefix: "Early " },
  "beginning of": { day: 5, prefix: "Early " },
};
const MID_MONTH = { day: 15, prefix: "" };
/** "in 3 weeks" → the Saturday nearest three weeks from today. */
function relativeDate(text: string, today: string): DateGuess | undefined {
  const rel = text.match(/\bin (\d+|a|one|two|three|four|five|six) (day|week|month)s?\b/i);
  if (!rel?.[1] || !rel[2]) return undefined;
  const n = toNumber(rel[1]) ?? 1;
  const unit = rel[2].toLowerCase();
  const iso = nearestSaturday(addDays(today, n * (UNIT_DAYS[unit] ?? 1)));
  return { date: iso, label: `In ${n} ${unit}${n === 1 ? "" : "s"}` };
}
/** "17 Oct", "3rd December 2027". */
function exactDate(text: string, base: Date): DateGuess | undefined {
  const exact = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\b(?:\\s+(\\d{4}))?`, "i"),
  );
  if (!exact?.[1] || !exact[2]) return undefined;
  const month = monthIndex(exact[2]);
  const year = exact[3] ? Number(exact[3]) : nextYearFor(month, base);
  const iso = toISO(new Date(year, month, Number(exact[1])));
  return { date: iso, label: longDate(iso) };
}
/** The year a month falls in: "next year", an explicit year, or the next time that month comes round. */
function yearFor(token: string | undefined, month: number, base: Date): number {
  if (token?.toLowerCase() === "next year") return base.getFullYear() + 1;
  return token ? Number(token) : nextYearFor(month, base);
}
/** "end of April next year", "December", "mid March 2027". */
function monthDate(text: string, base: Date): DateGuess | undefined {
  const loose = text.match(
    new RegExp(
      `\\b(end of|late|early|mid|start of|beginning of|in|by)?\\s*${MONTH_RE}\\b(?:\\s+(next year|\\d{4}))?`,
      "i",
    ),
  );
  const [, cue, monthToken, yearToken] = loose ?? [];
  // "may" is usually the verb; only read it as May with a cue like "in May" or "May 2027".
  if (!monthToken || (monthToken.toLowerCase() === "may" && !cue && !yearToken)) return undefined;
  const month = monthIndex(monthToken);
  const year = yearFor(yearToken, month, base);
  const part = MONTH_PART[cue?.toLowerCase() ?? ""] ?? MID_MONTH;
  const iso = toISO(new Date(year, month, part.day));
  return { date: iso, label: `${part.prefix}${cap(MONTH_NAMES[month]?.slice(0, 3) ?? "")} ${year}` };
}

/** Turns "end of April next year", "December", "in 3 weeks", "17 Oct" into a date and a readable label. */
export function detectDate(text: string, today = TODAY): DateGuess | undefined {
  const base = parseDate(today);
  return relativeDate(text, today) ?? exactDate(text, base) ?? monthDate(text, base);
}
function monthIndex(token: string): number {
  return MONTH_NAMES.findIndex((m) => m.startsWith(token.toLowerCase().slice(0, 3)));
}
function nextYearFor(month: number, base: Date): number {
  return month < base.getMonth() ? base.getFullYear() + 1 : base.getFullYear();
}
function nearestSaturday(iso: string): string {
  const d = parseDate(iso);
  const shift = (6 - d.getDay() + 7) % 7;
  return addDays(iso, shift > 3 ? shift - 7 : shift);
}
