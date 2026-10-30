import { addDays, dateRange, dayMonth, demoShift, longDate, monthName, shortDate, TODAY } from "../lib/dates";
import { birthday } from "./demo/birthday";
import { mela } from "./demo/mela";
import { wedding } from "./demo/wedding";
import type { EmptyEvent, NotificationItem, PastEvent, PlannrEvent } from "./types";

/**
 * One signed-in planner, three live events in three roles: Ananya's elder sister and
 * co-planner on the wedding, Aarav's mother, and cultural secretary of Green Valley Society.
 */
export const DEMO_USER = {
  name: "Priya Menon",
  firstName: "Priya",
  initials: "PM",
  plan: "Early access",
  city: "Kochi, Kerala",
  language: "English",
};

const anniversary: EmptyEvent = {
  id: "amma-achan-35",
  kind: "other",
  layout: "empty",
  name: "Mom & Dad's 35th anniversary",
  role: "CO-PLANNER",
  hue: "maroon",
  eyebrow: "Anniversary · shared by Anil Menon",
  navMeta: "Anniversary · no plan yet",
  listMeta: "Shared by Anil Menon · no plan yet",
  date: "2026-12-20",
  sharedBy: "Anil Menon",
};

const TOKEN = /\{(long|short|dm|month|range):(\d{4}-\d{2}-\d{2})(?::(\d{4}-\d{2}-\d{2}))?\}/g;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Moves every date in the demo by `days`, and renders dates written into text from the moved dates. */
export function freshen<T>(value: T, days: number): T {
  if (typeof value === "string") {
    if (ISO.test(value)) return addDays(value, days) as T;
    return value.replace(TOKEN, (_, kind: string, a: string, b?: string) => {
      const from = addDays(a, days);
      if (kind === "range") return dateRange(from, addDays(b ?? a, days));
      if (kind === "short") return shortDate(from);
      if (kind === "dm") return dayMonth(from);
      if (kind === "month") return monthName(from);
      return longDate(from);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => freshen(v, days)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = freshen(v, days);
    return out as T;
  }
  return value;
}

/** The demo events, moved so the story starts today. */
export function seedEvents(today = TODAY): PlannrEvent[] {
  return freshen([wedding, birthday, mela, anniversary], demoShift(today));
}

export const SEED_IDS = [wedding.id, birthday.id, mela.id, anniversary.id];
/** Bump when the sample events change, so returning demo visitors see the new ones. */
export const SEED_REVISION = 5;

/** Past events keep their real dates: they're history, and festivals happen when they happen. */
export function pastEvents(): PastEvent[] {
  return structuredClone(PAST_EVENTS);
}

export function seedNotifications(today = TODAY): NotificationItem[] {
  return freshen(NOTIFICATIONS, demoShift(today));
}

const PAST_EVENTS: PastEvent[] = [
  {
    id: "onam-26",
    name: "Onam sadhya for the family",
    kind: "other",
    date: "2026-09-05",
    summary: "₹38,000 spent · 42 guests",
  },
  {
    id: "ganesh-26",
    name: "Green Valley Ganesh Chaturthi",
    kind: "community",
    date: "2026-09-14",
    summary: "₹1.1L in funds · 9 volunteers",
  },
  {
    id: "achan-60",
    name: "Achan's 60th birthday",
    kind: "birthday",
    date: "2026-01-18",
    summary: "₹62,000 spent · 70 guests",
  },
  {
    id: "aarav-5",
    name: "Aarav's 5th birthday",
    kind: "birthday",
    date: "2025-10-18",
    summary: "Dinosaur theme · 38 guests",
  },
  {
    id: "office-onam",
    name: "Office Onam lunch",
    kind: "other",
    date: "2025-08-29",
    summary: "Draft, never planned",
    archived: true,
  },
  {
    id: "housewarming",
    name: "Housewarming, Kakkanad flat",
    kind: "other",
    date: "2025-06-08",
    summary: "₹54,000 spent · 60 guests",
    archived: true,
  },
];

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    text: "Rohan added 18 guests from Dubai. 3 changes wait for your approval.",
    when: "2 hours ago",
    eventId: "ananya-rohan",
    unread: true,
  },
  {
    id: "n2",
    text: "Sree Annapoorna sent a revised sadhya quote: ₹2,016 a leaf.",
    when: "Yesterday",
    eventId: "ananya-rohan",
    unread: true,
  },
  {
    id: "n3",
    text: "Rekha submitted ₹6,000 for rangoli colours and prizes.",
    when: "Yesterday",
    eventId: "green-valley-mela",
    unread: true,
  },
  {
    id: "n4",
    text: "29 of 50 guests have replied for Aarav's party.",
    when: "Fri",
    eventId: "aarav-6",
    unread: true,
  },
  {
    id: "n5",
    text: "The venue balance of ₹1,20,000 is due {short:2026-10-05}.",
    when: "Fri",
    eventId: "ananya-rohan",
    unread: true,
  },
  {
    id: "n6",
    text: "Arjun submitted the Lumen Events advance for approval.",
    when: "Thu",
    eventId: "green-valley-mela",
    unread: true,
  },
];
