/**
 * The intake: its prompt, and the schema that both asks Gemini for an answer and cleans it. Everything
 * here is pure so it can be tested without a network; the prompts live on the server
 * so the browser can't turn the proxy into a general-purpose model endpoint.
 */
import { z } from "zod";
import {
  calendarDay,
  choice,
  choices,
  clip,
  geminiSchema,
  type JsonSchema,
  maybe,
  parseAnswer,
  parseRequest,
  passedOn,
  requestBody,
  requestDate,
  requiredText,
  text,
  texts,
  VOICE,
  whole,
} from "./kit";

/** The kinds of event Plannr plans. */
export const KINDS = ["wedding", "birthday", "community", "other"] as const;
/** The wedding functions the intake recognises. */
export const FUNCTIONS = ["Engagement", "Mehendi", "Haldi", "Sangeet", "Ceremony", "Reception"] as const;
/** Where the family is with the venue. */
export const VENUE_STATUS = ["Booked", "Shortlisted", "Not started"] as const;

const intakeBody = requestBody({
  text: requiredText("text"),
  profile: passedOn(),
  today: requestDate(),
  asking: maybe(text(20)),
});

/** A description to read, with what's known so far and the question being asked. */
export type IntakeRequest = z.output<typeof intakeBody>;

/** Checks an intake request; throws BadRequest when the description is missing. */
export function intakeRequest(raw: unknown): IntakeRequest {
  return parseRequest(intakeBody, raw);
}

/** What the intake reads from a description, as Gemini sends it and as it's cleaned. */
const intakeAnswer = z.object({
  kind: maybe(choice(KINDS)),
  style: maybe(text(40)).describe("Short style, e.g. 'Kerala-style' or 'Space theme'"),
  names: maybe(text(60)).describe(
    "Who it is for: 'Ananya & Rohan' for a couple, a first name for a birthday",
  ),
  city: maybe(text(40)).describe("City or neighbourhood, properly capitalised"),
  date: maybe(calendarDay()).describe("Best single date as YYYY-MM-DD"),
  dateText: maybe(text(40)).describe("Readable label for the date, e.g. 'Late Apr 2027'"),
  guests: maybe(whole(1, 100_000)),
  budget: maybe(whole(1000, 10_000_000_000)).describe("Total budget in whole rupees (18 lakh = 1800000)"),
  venueStatus: maybe(choice(VENUE_STATUS)),
  venues: maybe(text(120)).describe("Venue name, or 'A or B' when choosing between two"),
  functions: choices(FUNCTIONS, 6).default([]),
  traditions: maybe(text(160)),
  needs: texts(6, 60)
    .default([])
    .describe(
      "Accessibility, dietary or allergy needs as short labels of at most four words, e.g. '2 wheelchair users', 'Vegetarian', '3 nut allergies'",
    ),
  moods: texts(4, 30).default([]),
  colours: texts(4, 30).default([]),
  coPlanners: texts(6, 40).default([]),
  // Asked for every time, but the details read without it are still worth keeping.
  reply: text(400)
    .catch("")
    .describe(
      "A short, warm acknowledgement under 25 words, the way a friend who plans events would reply. Never open with 'I have noted' or 'Got it'. Use digits and ₹ for numbers, don't list every detail back (the app shows them), and don't ask a question: the app asks the next one.",
    ),
});

/** The JSON schema for what the intake reads from a description. */
export const intakeSchema: JsonSchema = geminiSchema(intakeAnswer);

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

/** Cleans what the intake read: known kinds and functions, sane counts, and only future dates. */
export function sanitizeIntake(raw: unknown, today: string) {
  const { names, date, dateText, reply, ...fields } = parseAnswer(intakeAnswer, raw);
  const ahead = date !== undefined && date >= today;
  return {
    ...fields,
    names: names?.replace(/\s+and\s+/i, " & "),
    date: ahead ? date : undefined,
    dateText: ahead ? dateText : undefined,
    reply: reply || undefined,
  };
}

/** The profile fields read from a description, after cleaning. */
export type IntakeResult = ReturnType<typeof sanitizeIntake>;
