/**
 * Calendar files for "Add to calendar". Times are written in India time; a function
 * without a time becomes an all-day entry.
 */

import { download } from "./download";

export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  /** "6:00 pm", "10:42 am (tentative)", "18:30" or undefined. */
  time?: string;
  place?: string;
  description?: string;
}

/** "6:00 pm" → [18, 0]; anything unreadable → undefined. */
export function parseTime(text: string | undefined): [number, number] | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i) ?? text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "p" && h < 12) h += 12;
  if (ampm === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return undefined;
  return [h, min];
}

const pad = (n: number) => String(n).padStart(2, "0");
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\n/g, "\\n");

export function icsFile(items: CalendarItem[], stampedAt = new Date()): string {
  const stamp = stampedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plannr//Invitations//EN", "CALSCALE:GREGORIAN"];
  for (const it of items) {
    const date = it.date.replace(/-/g, "");
    const t = parseTime(it.time);
    lines.push("BEGIN:VEVENT", `UID:${it.id}@plannr`, `DTSTAMP:${stamp}`);
    if (t) {
      const [h, m] = t;
      const end = Math.min(23 * 60 + 59, h * 60 + m + 180);
      lines.push(
        `DTSTART;TZID=Asia/Kolkata:${date}T${pad(h)}${pad(m)}00`,
        `DTEND;TZID=Asia/Kolkata:${date}T${pad(Math.floor(end / 60))}${pad(end % 60)}00`,
      );
    } else {
      const next = new Date(`${it.date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`,
      );
    }
    lines.push(`SUMMARY:${esc(it.title)}`);
    if (it.place) lines.push(`LOCATION:${esc(it.place)}`);
    if (it.description) lines.push(`DESCRIPTION:${esc(it.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/** Offers the file as a download. */
export function downloadIcs(name: string, items: CalendarItem[]): void {
  download(`${name.replace(/[^\w-]+/g, "-").toLowerCase()}.ics`, icsFile(items), "text/calendar");
}

export function mapLink(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}
