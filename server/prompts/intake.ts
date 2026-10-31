import { BadRequest, clip, int, isObject, isoDate, oneOf, requireText, str, strList, VOICE } from "./kit";
/**
 * Prompts, response schemas and output sanitizers for the intake, assistant and plan routes. Everything
 * here is pure so it can be tested without a network; the prompts live on the server
 * so the browser can't turn the proxy into a general-purpose model endpoint.
 */

export const KINDS = ["wedding", "birthday", "community", "other"] as const;
/** The wedding functions the intake recognises. */
export const FUNCTIONS = ["Engagement", "Mehendi", "Haldi", "Sangeet", "Ceremony", "Reception"] as const;
/** Where the family is with the venue. */
export const VENUE_STATUS = ["Booked", "Shortlisted", "Not started"] as const;

/** A description to read, with what's known so far and the question being asked. */
export interface IntakeRequest {
  text: string;
  profile: unknown;
  today: string;
  asking?: string | undefined;
}

/** Checks an intake request; throws BadRequest when the description is missing. */
export function intakeRequest(body: unknown): IntakeRequest {
  if (!isObject(body)) throw new BadRequest("Expected a JSON object");
  return {
    text: requireText(body["text"], "text"),
    profile: body["profile"] ?? {},
    today: isoDate(body["today"]) ?? new Date().toISOString().slice(0, 10),
    asking: str(body["asking"], 20),
  };
}

/** The JSON schema for what the intake reads from a description. */
export const intakeSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...KINDS] },
    style: { type: "string", description: "Short style, e.g. 'Kerala-style' or 'Space theme'" },
    names: {
      type: "string",
      description: "Who it is for: 'Ananya & Rohan' for a couple, a first name for a birthday",
    },
    city: { type: "string", description: "City or neighbourhood, properly capitalised" },
    date: { type: "string", description: "Best single date as YYYY-MM-DD" },
    dateText: { type: "string", description: "Readable label for the date, e.g. 'Late Apr 2027'" },
    guests: { type: "integer" },
    budget: { type: "integer", description: "Total budget in whole rupees (18 lakh = 1800000)" },
    venueStatus: { type: "string", enum: [...VENUE_STATUS] },
    venues: { type: "string", description: "Venue name, or 'A or B' when choosing between two" },
    functions: { type: "array", items: { type: "string", enum: [...FUNCTIONS] } },
    traditions: { type: "string" },
    needs: {
      type: "array",
      items: { type: "string" },
      description:
        "Accessibility, dietary or allergy needs as short labels of at most four words, e.g. '2 wheelchair users', 'Vegetarian', '3 nut allergies'",
    },
    moods: { type: "array", items: { type: "string" } },
    colours: { type: "array", items: { type: "string" } },
    coPlanners: { type: "array", items: { type: "string" } },
    reply: {
      type: "string",
      description:
        "A short, warm acknowledgement under 25 words, the way a friend who plans events would reply. Never open with 'I have noted' or 'Got it'. Use digits and ₹ for numbers, don't list every detail back (the app shows them), and don't ask a question: the app asks the next one.",
    },
  },
  required: ["reply"],
} as const;

/** The intake prompt: read the description into profile fields, in any Indian language. */
export function intakePrompt(r: IntakeRequest): { system: string; user: string } {
  return {
    system: `${VOICE}
You read what someone says about an event they are planning and pull out structured details.
Only fill a field when the latest message states it or clearly implies it; leave everything else out.
Today is ${r.today}. Resolve relative dates ("next April", "in three weeks", "end of December") against today
and always pick a future date. "Lakh" is 100000 and "crore" is 10000000; "18L" means 1800000 rupees.
A wedding always includes the Ceremony function. Match the user's language in "reply".`,
    user: `What is known so far: ${clip(r.profile, 6000)}
${r.asking ? `The app just asked about: ${r.asking}\n` : ""}Latest message: """${r.text}"""`,
  };
}

/** The profile fields read from a description, after cleaning. */
export interface IntakeResult {
  kind?: (typeof KINDS)[number] | undefined;
  style?: string | undefined;
  names?: string | undefined;
  city?: string | undefined;
  date?: string | undefined;
  dateText?: string | undefined;
  guests?: number | undefined;
  budget?: number | undefined;
  venueStatus?: (typeof VENUE_STATUS)[number] | undefined;
  venues?: string | undefined;
  functions: string[];
  traditions?: string | undefined;
  needs: string[];
  moods: string[];
  colours: string[];
  coPlanners: string[];
  reply?: string | undefined;
}

/** Cleans what the intake read: known kinds and functions, sane counts, and only future dates. */
export function sanitizeIntake(raw: unknown, today: string): IntakeResult {
  const r = isObject(raw) ? raw : {};
  const date = isoDate(r["date"]);
  return {
    kind: oneOf(r["kind"], KINDS),
    style: str(r["style"], 40),
    names: str(r["names"], 60)?.replace(/\s+and\s+/i, " & "),
    city: str(r["city"], 40),
    date: date && date >= today ? date : undefined,
    dateText: date && date >= today ? str(r["dateText"], 40) : undefined,
    guests: int(r["guests"], 1, 100000),
    budget: int(r["budget"], 1000, 10_000_000_000),
    venueStatus: oneOf(r["venueStatus"], VENUE_STATUS),
    venues: str(r["venues"], 120),
    functions: strList(r["functions"], 6).flatMap((f) => oneOf(f, FUNCTIONS) ?? []),
    traditions: str(r["traditions"], 160),
    needs: strList(r["needs"], 6, 60),
    moods: strList(r["moods"], 4, 30),
    colours: strList(r["colours"], 4, 30),
    coPlanners: strList(r["coPlanners"], 6, 40),
    reply: str(r["reply"], 400),
  };
}
