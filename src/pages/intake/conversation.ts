import type { Kind } from "../../data/baseTypes";
import type { Profile } from "../../data/types";
import { detectKind, parseDescription } from "../../lib/intake";
import { detectDate } from "../../lib/intakeDates";
import { nextQuestion, type Question, type QuestionField } from "../../lib/intakeQuestions";
import { KIND_LABEL } from "../../lib/profileRows";
import type { Draft } from "../../store/types";

/**
 * How the intake chat talks: what it says back after each answer and which question it asks next.
 * Pure functions over the profile, so the conversation can be tested without a browser.
 */

let turnSeq = 0;
export const turnId = () => {
  turnSeq += 1;
  return `c${Date.now().toString(36)}${turnSeq}`;
};

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six"];
export const DONE =
  "That's everything I need. Press Draft my plan when you're ready, or tell me who's planning with you.";

export const KIND_FROM_CHIP: Record<string, Kind> = {
  Wedding: "wedding",
  Birthday: "birthday",
  "Community event": "community",
  "Something else": "other",
};

function joinList(parts: string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function opener(p: Profile): string {
  if (!p.kind && !p.city && !p.guests && !p.budget) return "Thanks. Let's take it one step at a time.";
  if (p.kind === "wedding" && p.names)
    return `Congratulations to ${p.names.replace(" & ", " and ")}. I've filled in most of the profile from that. A few quick questions and I'll draft the plan.`;
  if (p.kind === "birthday")
    return `${p.style ? `A ${p.style.replace(" theme", "").toLowerCase()} party sounds brilliant. ` : ""}I've filled in what I could. A couple of quick questions and I'll draft the plan.`;
  if (p.kind === "community")
    return "A mela has a lot of moving parts. I've filled in what I could from that; a few quick questions and I'll draft the plan.";
  return "Got it. I've filled in what I could from that.";
}

export function acknowledge(prev: Profile, next: Profile): string {
  const parts: string[] = [];
  if (next.functions.length > prev.functions.length && next.functions.length > 1)
    parts.push(`${NUMBER_WORDS[next.functions.length] ?? next.functions.length} functions`);
  const fresh = next.needs.filter((n) => !prev.needs.includes(n));
  if (fresh.some((n) => /wheelchair/i.test(n)))
    parts.push(
      next.venues?.includes(" or ")
        ? "I'll flag step-free access when comparing the two venues"
        : "I'll flag step-free access with the venue",
    );
  if (fresh.includes("Vegetarian")) parts.push("a vegetarian menu");
  if (fresh.some((n) => /allerg/i.test(n))) parts.push("allergy notes on the RSVP form");
  if (next.venues && next.venues !== prev.venues && parts.length === 0) parts.push(`venue: ${next.venues}`);
  return parts.length > 0 ? `Noted: ${joinList(parts)}.` : "Noted.";
}

/** The chat's first line, shaped by what's already known (from "Plan a wedding", say). */
export function greetingFor(kind: Kind | undefined, names: string | undefined): string {
  if (!kind)
    return "Describe the event in a sentence or two: what, where, roughly when, how many people and the budget. I'll ask only for what's missing.";
  if (kind === "other" && names)
    return `Let's plan ${names}. Where is it, roughly when, how many guests and what budget?`;
  return `Tell me about the ${KIND_LABEL[kind].toLowerCase()}: where, roughly when, how many guests and the budget. I'll ask only for what's missing.`;
}

/** Questions answered once and not asked again, even when the answer added nothing. */
const ASK_ONCE: QuestionField[] = ["venue", "extras", "priorities"];

/** The questions asked so far, after answering `field`. */
export function askedAfter(asked: QuestionField[], field: QuestionField | undefined): QuestionField[] {
  return field && ASK_ONCE.includes(field) ? [...new Set([...asked, field])] : asked;
}

interface Turn {
  field: QuestionField | undefined;
  isFirst: boolean;
  aiReply: string | undefined;
  prev: Profile;
  next: Profile;
  question: Question | null;
}

const DATE_NUDGE = "I couldn't place that date. A month is enough, like “December” or “in 3 weeks”.";

/** Gemini's reply to a first message or to the extras; otherwise a summary of what was understood. */
function openingFor({ field, isFirst, aiReply, prev, next }: Turn): string {
  if ((isFirst || field === "extras") && aiReply) return aiReply;
  if (isFirst) return opener(next);
  return field === "extras" ? acknowledge(prev, next) : "";
}

/**
 * What Plannr says before its next question: the opening, or a nudge when a date couldn't be
 * read, and a closing line when there's nothing left to ask.
 */
export function leadFor(turn: Turn): string {
  const lead = turn.field === "date" && !turn.next.date ? DATE_NUDGE : openingFor(turn);
  if (!turn.question) return lead ? `${lead} ${DONE}` : DONE;
  return turn.question.field === "priorities" && lead ? `${lead} Last one:` : lead;
}

/** The next question, phrased for what was just answered. */
export function questionAfter(p: Profile, asked: QuestionField[], answered?: QuestionField): Question | null {
  const q = nextQuestion(p, new Set(asked));
  if (q?.field === "extras" && answered === "venue") {
    const tail =
      p.kind === "wedding"
        ? "Add any other functions, traditions or accessibility needs too."
        : "Add anything else I should plan around.";
    if (p.venueStatus === "Shortlisted")
      return { ...q, prompt: `Which ones are you choosing between? ${tail}` };
    if (p.venueStatus === "Booked") return { ...q, prompt: `Which venue is it? ${tail}` };
    return { ...q, prompt: `No problem, I'll put venue visits in the first week. ${tail}` };
  }
  return q;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A bare "18" to the budget question means lakhs; anything bigger is rupees. */
const LAKH = 100_000;
const LONGEST_CITY = 40;

/** The leading number in a short answer: "250", "2,50,000", "18.5". */
function leadingNumber(text: string): number {
  return Number(text.match(/\d[\d,.]*/)?.[0]?.replace(/,/g, ""));
}

/** Questions whose short answers have a reader of their own; each names the profile field it fills. */
type ShortField = "kind" | "city" | "guests" | "budget" | "date";

/** How to read a short answer to each question when the full parser found nothing. */
const SHORT_ANSWERS: Record<ShortField, (text: string) => Partial<Profile> | undefined> = {
  kind: (text) => ({ kind: detectKind(text) ?? "other" }),
  city: (text) => {
    const city = text.trim().split(/[,.]/)[0]?.trim();
    return city && city.length <= LONGEST_CITY ? { city: titleCase(city) } : undefined;
  },
  guests: (text) => {
    const n = Math.trunc(leadingNumber(text));
    return n > 0 ? { guests: n } : undefined;
  },
  budget: (text) => {
    const n = leadingNumber(text);
    if (!(n > 0)) return undefined;
    return { budget: n < 1000 ? n * LAKH : n };
  },
  date: (text) => {
    const d = detectDate(`in ${text}`);
    return d ? { date: d.date, dateText: d.label } : undefined;
  },
};

function isShortField(field: QuestionField | undefined): field is ShortField {
  return !!field && Object.hasOwn(SHORT_ANSWERS, field);
}

/** Field-specific fallbacks for short answers like "Thrissur" or "18". */
export function readAnswer(text: string, p: Profile, field: QuestionField | undefined): Profile {
  const parsed = parseDescription(text, p);
  // Only when the parser didn't already fill the field the question asked about.
  const fallback = isShortField(field) && !parsed[field] ? SHORT_ANSWERS[field](text) : undefined;
  const next = { ...parsed, ...fallback };
  const link = text.match(/https?:\/\/\S+|\b[\w-]+\.(?:com|in|co)\/\S*/i)?.[0];
  if (link && !next.inspiration.includes(link)) next.inspiration = [...next.inspiration, link];
  return next;
}

export function pendingField(d: Draft): QuestionField | undefined {
  const last = d.chat[d.chat.length - 1];
  return last?.role === "ai" ? last.question?.field : undefined;
}
