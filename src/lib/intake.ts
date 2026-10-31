import type { Kind } from "../data/baseTypes";
import type { Profile } from "../data/types";
import { TODAY } from "./dates";
import { detectDate, MONTH_RE } from "./intakeDates";
import { cap, toNumber } from "./intakeWords";

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
export const FUNCTION_ORDER = ["Engagement", "Mehendi", "Haldi", "Sangeet", "Ceremony", "Reception"];

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

/** "my parents use wheelchairs" → "2 wheelchair users"; a bare mention → "Wheelchair access". */
function wheelchairNeed(text: string): string | undefined {
  const wheel = text.match(/\b(\w+)\s+(?:\w+\s+){0,2}(?:use|uses|need|needs|in)\s+(?:a\s+)?wheelchairs?\b/i);
  const n = wheel?.[1] ? toNumber(wheel[1]) : undefined;
  if (n && n > 1) return `${n} wheelchair users`;
  return wheel || /wheelchair/i.test(text) ? "Wheelchair access" : undefined;
}

/** "3 kids have nut allergies" → "3 nut allergies"; a bare mention → "Allergies to note". */
function allergyNeed(text: string): string | undefined {
  const allergy = text.match(
    /\b(\w+)\s+(?:kids?|guests?|children)\s+(?:have|with)\s+(nut|peanut|gluten|dairy|egg)?\s*allerg/i,
  );
  if (!allergy) return /allerg/i.test(text) ? "Allergies to note" : undefined;
  const n = allergy[1] ? toNumber(allergy[1]) : undefined;
  const what = allergy[2]?.toLowerCase();
  return [n, what, "allergies"].filter(Boolean).join(" ");
}

function detectNeeds(text: string, current: string[]): string[] {
  const vegetarian = /\b(veg|vegetarian|sadhya)\b/i.test(text) && !/\bnon[- ]?veg/i.test(text);
  const found = [wheelchairNeed(text), vegetarian ? "Vegetarian" : undefined, allergyNeed(text)];
  return [...new Set([...current, ...found.filter((n): n is string => !!n)])];
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
  return parts.length > 0 ? parts.join(", ") : undefined;
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
