import type { Kind, Profile } from "../../data/types";
import {
  detectDate,
  detectKind,
  nextQuestion,
  parseDescription,
  type Question,
  type QuestionField,
} from "../../lib/intake";
import type { Draft } from "../../store/store";

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
  if (next.venues && next.venues !== prev.venues && !parts.length) parts.push(`venue: ${next.venues}`);
  return parts.length ? `Noted: ${joinList(parts)}.` : "Noted.";
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

/** Field-specific fallbacks for short answers like "Thrissur" or "18". */
export function readAnswer(text: string, p: Profile, field: QuestionField | undefined): Profile {
  const next = parseDescription(text, p);
  if (field === "kind" && !next.kind) next.kind = detectKind(text) ?? "other";
  if (field === "city" && !next.city) {
    const city = text.trim().split(/[,.]/)[0]?.trim();
    if (city && city.length <= 40) next.city = titleCase(city);
  }
  if (field === "guests" && !next.guests) {
    const n = Number(text.match(/\d[\d,]*/)?.[0]?.replace(/,/g, ""));
    if (n > 0) next.guests = n;
  }
  if (field === "budget" && !next.budget) {
    const n = Number(text.match(/\d[\d,.]*/)?.[0]?.replace(/,/g, ""));
    // A bare "18" to the budget question means lakhs; anything bigger is rupees.
    if (n > 0) next.budget = n < 1000 ? n * 100000 : n;
  }
  if (field === "date" && !next.date) {
    const d = detectDate(`in ${text}`);
    if (d) {
      next.date = d.date;
      next.dateText = d.label;
    }
  }
  const link = text.match(/https?:\/\/\S+|\b[\w-]+\.(?:com|in|co)\/\S*/i)?.[0];
  if (link && !next.inspiration.includes(link)) next.inspiration = [...next.inspiration, link];
  return next;
}

export function pendingField(d: Draft): QuestionField | undefined {
  const last = d.chat[d.chat.length - 1];
  return last?.role === "ai" ? last.question?.field : undefined;
}
