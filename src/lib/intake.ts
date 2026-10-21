import type { Kind, Profile } from "../data/types";
import { addDays, longDate, MONTH_NAMES, parseDate, TODAY, toISO } from "./dates";

export function emptyProfile(): Profile {
  return {
    functions: [],
    needs: [],
    moods: [],
    colours: [],
    inspiration: [],
    priorities: [],
    cuts: [],
    coPlanners: [],
  };
}

const WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function toNumber(raw: string): number | undefined {
  const word = WORDS[raw.toLowerCase()];
  if (word !== undefined) return word;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const CITIES: Record<string, string> = {
  kochi: "Kochi",
  cochin: "Kochi",
  ernakulam: "Kochi",
  kakkanad: "Kakkanad",
  thrissur: "Thrissur",
  kozhikode: "Kozhikode",
  calicut: "Kozhikode",
  thiruvananthapuram: "Thiruvananthapuram",
  trivandrum: "Thiruvananthapuram",
  kottayam: "Kottayam",
  alappuzha: "Alappuzha",
  kannur: "Kannur",
  bengaluru: "Bengaluru",
  bangalore: "Bengaluru",
  chennai: "Chennai",
  mumbai: "Mumbai",
  pune: "Pune",
  delhi: "Delhi",
  hyderabad: "Hyderabad",
  kolkata: "Kolkata",
  mysuru: "Mysuru",
  coimbatore: "Coimbatore",
  madurai: "Madurai",
  mangaluru: "Mangaluru",
  goa: "Goa",
  jaipur: "Jaipur",
  ahmedabad: "Ahmedabad",
  lucknow: "Lucknow",
  chandigarh: "Chandigarh",
  gurugram: "Gurugram",
  noida: "Noida",
};

const FUNCTIONS: [RegExp, string][] = [
  [/\bengagement\b/i, "Engagement"],
  [/\bmeh(e)?nd(i|hi)\b/i, "Mehendi"],
  [/\bhaldi\b/i, "Haldi"],
  [/\bsangeet\b/i, "Sangeet"],
  [/\breception\b/i, "Reception"],
];
const MONTH_RE =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";

const FUNCTION_ORDER = ["Engagement", "Mehendi", "Haldi", "Sangeet", "Ceremony", "Reception"];

export function detectKind(text: string): Kind | undefined {
  if (/\b(wedding|marriage|kalyanam|shaadi|nikah|vivah)\b/i.test(text)) return "wedding";
  if (/\b(birthday|b'?day)\b|\bturns?\s+\d+\b/i.test(text)) return "birthday";
  if (
    /\b(mela|diwali|onam|ganesh\w*|navratri|society|community|festival|fest|association|residents)\b/i.test(
      text,
    )
  )
    return "community";
  if (
    /\b(housewarming|anniversary|naming|reunion|baptism|retirement|party|dinner|get-together)\b/i.test(text)
  )
    return "other";
  return undefined;
}

function detectStyle(text: string): string | undefined {
  const theme = text.match(/\b([a-z]+)[- ]themed?\b/i);
  if (theme?.[1]) return `${cap(theme[1])} theme`;
  const region = text.match(
    /\b(kerala|tamil|telugu|kannada|punjabi|bengali|gujarati|marathi|south indian|north indian|christian|muslim)\b/i,
  );
  if (region?.[1]) return `${cap(region[1])}-style`;
  return undefined;
}

function cap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectNames(text: string, kind: Kind | undefined): string | undefined {
  const couple = text.match(/\bfor (?:my \w+ )?([A-Z][a-z]+) (?:and|&) ([A-Z][a-z]+)/);
  if (couple?.[1] && couple[2]) return `${couple[1]} & ${couple[2]}`;
  if (kind === "birthday") {
    const child =
      text.match(/\b([A-Z][a-z]+)(?:'s|’s)\s+(?:\d+\w*\s+)?birthday/) ??
      text.match(/\b([A-Z][a-z]+) turns \d+/) ??
      text.match(/\bfor ([A-Z][a-z]+)\b/);
    if (child?.[1]) return child[1];
  }
  return undefined;
}

/** Known cities first; a bare "in Somewhere" only counts when no city is known yet. */
function detectCity(text: string, allowLoose: boolean): string | undefined {
  const lower = text.toLowerCase();
  for (const key of Object.keys(CITIES)) {
    if (new RegExp(`\\b${key}\\b`).test(lower)) return CITIES[key];
  }
  if (!allowLoose) return undefined;
  const loose = text.match(/\bin ([A-Z][a-z]{2,})\b/);
  if (loose?.[1] && !new RegExp(`^${MONTH_RE}$`, "i").test(loose[1])) return loose[1];
  return undefined;
}

export function detectGuests(text: string): number | undefined {
  const split = text.match(/(\w+)\s*(?:kids|children)\s*(?:and|&|\+|,)\s*(\w+)\s*adults/i);
  if (split?.[1] && split[2]) {
    const a = toNumber(split[1]);
    const b = toNumber(split[2]);
    if (a !== undefined && b !== undefined) return a + b;
  }
  const m = text.match(/(\d[\d,]*)\s*(?:guests|people|attendees|persons|pax|heads|visitors)/i);
  return m?.[1] ? toNumber(m[1]) : undefined;
}

const UNITS: Record<string, number> = {
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  lacs: 1e5,
  l: 1e5,
  k: 1e3,
  thousand: 1e3,
  cr: 1e7,
  crore: 1e7,
};

export function detectBudget(text: string): number | undefined {
  const m =
    text.match(/(?:₹|\brs\.?|\binr)\s*([\d.,]+)\s*(lakhs?|lacs?|l|k|thousand|cr|crore)?\b/i) ??
    text.match(/\b([\d.]+)\s*(lakhs?|lacs?|crore)\b/i) ??
    text.match(/budget\D{0,12}([\d.,]+)\s*(k|lakhs?|l)?\b/i);
  if (!m?.[1]) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const unit = m[2] ? UNITS[m[2].toLowerCase()] : undefined;
  return Math.round(n * (unit ?? 1));
}

/** Turns "end of April next year", "December", "in 3 weeks", "17 Oct" into a date and a readable label. */
export function detectDate(text: string, today = TODAY): { date: string; label: string } | undefined {
  const base = parseDate(today);
  const rel = text.match(/\bin (\d+|a|one|two|three|four|five|six) (day|week|month)s?\b/i);
  if (rel?.[1] && rel[2]) {
    const n = toNumber(rel[1]) ?? 1;
    const days = rel[2].toLowerCase() === "day" ? n : rel[2].toLowerCase() === "week" ? n * 7 : n * 30;
    const iso = nearestSaturday(addDays(today, days));
    return { date: iso, label: `In ${n} ${rel[2].toLowerCase()}${n === 1 ? "" : "s"}` };
  }
  const exact = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\b(?:\\s+(\\d{4}))?`, "i"),
  );
  if (exact?.[1] && exact[2]) {
    const month = monthIndex(exact[2]);
    const year = exact[3] ? Number(exact[3]) : nextYearFor(month, base);
    const iso = toISO(new Date(year, month, Number(exact[1])));
    return { date: iso, label: longDate(iso) };
  }
  const loose = text.match(
    new RegExp(
      `\\b(end of|late|early|mid|start of|beginning of|in|by)?\\s*${MONTH_RE}\\b(?:\\s+(next year|\\d{4}))?`,
      "i",
    ),
  );
  // "may" is usually the verb; only read it as May with a cue like "in May" or "May 2027".
  const verbMay = loose?.[2]?.toLowerCase() === "may" && !loose[1] && !loose[3];
  if (loose?.[2] && !verbMay) {
    const month = monthIndex(loose[2]);
    const cue = loose[1]?.toLowerCase();
    const when = cue === "in" || cue === "by" ? undefined : cue;
    const year =
      loose[3]?.toLowerCase() === "next year"
        ? base.getFullYear() + 1
        : loose[3]
          ? Number(loose[3])
          : nextYearFor(month, base);
    const day = when === "end of" || when === "late" ? 25 : when === "mid" ? 15 : when ? 5 : 15;
    const iso = toISO(new Date(year, month, day));
    const prefix =
      when === "end of" || when === "late" ? "Late " : when === "mid" ? "Mid " : when ? "Early " : "";
    const label = `${prefix}${cap(MONTH_NAMES[month]?.slice(0, 3) ?? "")} ${year}`;
    return { date: iso, label };
  }
  return undefined;
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

function detectFunctions(text: string, kind: Kind | undefined, current: string[]): string[] {
  const found = new Set(current);
  for (const [re, name] of FUNCTIONS) if (re.test(text)) found.add(name);
  if (kind === "wedding") found.add("Ceremony");
  return FUNCTION_ORDER.filter((f) => found.has(f));
}

function detectVenue(text: string): Pick<Profile, "venueStatus" | "venues"> {
  const out: Pick<Profile, "venueStatus" | "venues"> = {};
  if (/\bat home\b/i.test(text)) return { venueStatus: "Booked", venues: "Home" };
  if (/\bshortlist/i.test(text)) out.venueStatus = "Shortlisted";
  else if (/\b(venue|hall)\s+(is\s+)?(booked|confirmed)\b|\bbooked\s+(the\s+)?(venue|hall)\b/i.test(text))
    out.venueStatus = "Booked";
  const named = text.match(
    /([A-Z][\w']*(?: [A-Z][\w']*)* (?:Centre|Center|Hall|Banquets?|Resort|Hotel|Auditorium|Grounds?|Convention Centre))(?:[^.]*?\bor\s+([A-Z][\w']*(?: [A-Z][\w']*)*))?/,
  );
  if (named?.[1]) {
    out.venues = named[2] ? `${named[1]} or ${named[2]}` : named[1];
    out.venueStatus ??= named[2] ? "Shortlisted" : "Booked";
  }
  return out;
}

function detectNeeds(text: string, current: string[]): string[] {
  const needs = new Set(current);
  const wheel = text.match(/\b(\w+)\s+(?:\w+\s+){0,2}(?:use|uses|need|needs|in)\s+(?:a\s+)?wheelchairs?\b/i);
  if (wheel) {
    const n = wheel[1] ? toNumber(wheel[1]) : undefined;
    needs.add(n && n > 1 ? `${n} wheelchair users` : "Wheelchair access");
  } else if (/wheelchair/i.test(text)) needs.add("Wheelchair access");
  if (/\b(veg|vegetarian|sadhya)\b/i.test(text) && !/\bnon[- ]?veg/i.test(text)) needs.add("Vegetarian");
  const allergy = text.match(
    /\b(\w+)\s+(?:kids?|guests?|children)\s+(?:have|with)\s+(nut|peanut|gluten|dairy|egg)?\s*allerg/i,
  );
  if (allergy) {
    const n = allergy[1] ? toNumber(allergy[1]) : undefined;
    needs.add(`${n ? `${n} ` : ""}${allergy[2] ? `${allergy[2].toLowerCase()} ` : ""}allergies`.trim());
  } else if (/allerg/i.test(text)) needs.add("Allergies to note");
  return [...needs];
}

function detectTraditions(
  text: string,
  kind: Kind | undefined,
  style: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (/sadhya/i.test(text) || (kind === "wedding" && style === "Kerala-style"))
    parts.push("Sadhya on banana leaf");
  if (/nilavilakku|lamp/i.test(text) || (kind === "wedding" && style === "Kerala-style"))
    parts.push("nilavilakku lighting");
  if (/rangoli/i.test(text)) parts.push("Rangoli contest");
  if (/cultural/i.test(text)) parts.push("Cultural night");
  return parts.length ? parts.join(", ") : undefined;
}

/** Merge whatever a free-text description reveals into the profile. Never erases what is known. */
export function parseDescription(text: string, profile: Profile, today = TODAY): Profile {
  const kind = detectKind(text) ?? profile.kind;
  const style = detectStyle(text) ?? profile.style;
  const date = detectDate(text, today);
  const venue = detectVenue(text);
  return {
    ...profile,
    kind,
    style,
    names: detectNames(text, kind) ?? profile.names,
    city: detectCity(text, !profile.city) ?? profile.city,
    guests: detectGuests(text) ?? profile.guests,
    budget: detectBudget(text) ?? profile.budget,
    date: date?.date ?? profile.date,
    dateText: date?.label ?? profile.dateText,
    functions: detectFunctions(text, kind, profile.functions),
    venueStatus: venue.venueStatus ?? profile.venueStatus,
    venues: venue.venues ?? profile.venues,
    needs: detectNeeds(text, profile.needs),
    traditions: detectTraditions(text, kind, style) ?? profile.traditions,
  };
}

export type QuestionField =
  | "kind"
  | "city"
  | "date"
  | "guests"
  | "budget"
  | "venue"
  | "extras"
  | "priorities";

export interface Question {
  field: QuestionField;
  prompt: string;
  options?: string[];
}

export const PRIORITY_OPTIONS: Record<Kind, { most: string[]; cut: string[] }> = {
  wedding: {
    most: ["Food", "Photography", "Ceremony décor", "Attire", "Entertainment", "Guest stay"],
    cut: ["Reception DJ", "Favours", "Printed invitations"],
  },
  birthday: {
    most: ["Food", "Entertainer", "Cake", "Décor", "Return gifts", "Photos"],
    cut: ["Second balloon arch", "Printed invitations", "Professional photos"],
  },
  community: {
    most: ["Stalls", "Cultural night", "Safety", "Food", "Lights & décor", "Prizes"],
    cut: ["Fireworks", "Printed passes", "Chief guest"],
  },
  other: {
    most: ["Food", "Venue", "Décor", "Photos", "Entertainment", "Gifts"],
    cut: ["Printed invitations", "Favours", "DJ"],
  },
};

/** The single next thing Plannr still needs, or null when it can draft. */
export function nextQuestion(p: Profile, asked: ReadonlySet<QuestionField>): Question | null {
  if (!p.kind)
    return {
      field: "kind",
      prompt: "What kind of event is it?",
      options: ["Wedding", "Birthday", "Community event", "Something else"],
    };
  if (!p.city) return { field: "city", prompt: "Which city or neighbourhood is it in?" };
  if (!p.date) return { field: "date", prompt: "Roughly when? A month is enough for now." };
  if (!p.guests) return { field: "guests", prompt: "About how many guests?" };
  if (!p.budget) return { field: "budget", prompt: "What's the total budget you have in mind?" };
  if (!p.venueStatus && !asked.has("venue"))
    return {
      field: "venue",
      prompt: "Is a venue booked yet?",
      options: ["Booked", "Shortlisted", "Not started"],
    };
  if (!asked.has("extras"))
    return {
      field: "extras",
      prompt:
        p.kind === "wedding"
          ? "Any other functions, traditions or accessibility needs I should plan around?"
          : p.kind === "birthday"
            ? "Any allergies, a theme, or anything the kids will remember?"
            : "Anything else: segments of the day, permits you know about, or accessibility needs?",
    };
  if (!asked.has("priorities"))
    return {
      field: "priorities",
      prompt: "What matters most? Pick up to three, and anything you'd cut first if money gets tight.",
    };
  return null;
}

export const KIND_LABEL: Record<Kind, string> = {
  wedding: "Wedding",
  birthday: "Birthday",
  community: "Community event",
  other: "Event",
};

export interface ProfileRow {
  key: string;
  label: string;
  value: string;
  state: "ok" | "ask" | "todo";
}

/** The ten lines of "What I've understood". */
export function profileRows(p: Profile, asking?: QuestionField): ProfileRow[] {
  const row = (
    key: string,
    label: string,
    value: string | undefined,
    field?: QuestionField,
    hint = "",
  ): ProfileRow => {
    if (value) return { key, label, value, state: "ok" };
    if (field && asking === field) return { key, label, value: "Answering now…", state: "ask" };
    return { key, label, value: hint, state: "todo" };
  };
  const venue = p.venueStatus
    ? `${p.city ?? ""}${p.city ? " · " : ""}${p.venueStatus === "Shortlisted" && p.venues?.includes(" or ") ? "2 shortlisted" : (p.venues ?? p.venueStatus.toLowerCase())}`
    : p.city;
  return [
    row(
      "event",
      "Event",
      p.kind ? [KIND_LABEL[p.kind], p.style].filter(Boolean).join(" · ") : undefined,
      "kind",
    ),
    row("functions", "Functions", p.functions.length ? p.functions.join(", ") : undefined, "extras"),
    row("date", "Date", p.dateText, "date"),
    row("city", "City & venue", venue, p.city ? "venue" : "city"),
    row("guests", "Guests", p.guests ? `About ${p.guests}` : undefined, "guests"),
    row("budget", "Budget", p.budget ? `₹${p.budget.toLocaleString("en-IN")}` : undefined, "budget"),
    row("traditions", "Traditions", p.traditions, "extras"),
    row("needs", "Needs", p.needs.length ? p.needs.join(" · ") : undefined, "extras"),
    row("priorities", "Priorities", p.priorities.length ? p.priorities.join(" · ") : undefined, "priorities"),
    row(
      "co",
      "Co-planners",
      p.coPlanners.length ? p.coPlanners.join(", ") : undefined,
      undefined,
      "Next: who's planning with you",
    ),
  ];
}
