import { z } from "zod";
import {
  choice,
  clip,
  geminiSchema,
  type JsonSchema,
  maybe,
  parseAnswer,
  parseRequest,
  record,
  requestBody,
  requestDate,
  rows,
  text,
  texts,
  VOICE,
  whole,
} from "./kit";

/** Ideas for one event from a brief the browser builds; guests appear as counts only. */

export const EFFORTS = ["low", "medium", "high"] as const;
const MAX_IDEAS = 6;

const ideasBody = requestBody(
  {
    brief: record("brief is required"),
    // Titles already on the ideas board, so the model suggests something new.
    avoid: texts(40, 160),
    today: requestDate(),
  },
  "brief is required",
);

/** An ideas request: the event brief, titles to avoid and today's date. */
export type IdeasRequest = z.output<typeof ideasBody>;

/** Checks an ideas request; throws BadRequest when the brief is missing. */
export function ideasRequest(raw: unknown): IdeasRequest {
  return parseRequest(ideasBody, raw);
}

/** One idea, as Gemini sends it and as it's cleaned. */
const idea = z.object({
  title: text(120).describe("The idea in under ten words"),
  detail: text(320).describe("One or two sentences on what to do"),
  because: text(200).describe("The detail of this event it answers, in under 20 words"),
  cost: maybe(whole(1, 10_000_000)).describe("Rough extra cost in rupees, 0 when it costs nothing extra"),
  effort: choice(EFFORTS, "medium"),
  category: maybe(text(60)).describe(
    "The budget line it belongs to, named exactly as in the brief, or empty",
  ),
});

const ideasAnswer = z.object({
  ideas: rows(idea).describe("Four to six ideas, each answering a different detail of this event"),
});

/** The JSON schema for a list of ideas. */
export const ideasSchema: JsonSchema = geminiSchema(ideasAnswer);

/** The ideas prompt: specific to this event, never generic. */
export function ideasPrompt(r: IdeasRequest): { system: string; user: string } {
  return {
    system: `${VOICE}
You suggest ideas that make one event feel like the family's own: theme, décor, food, guest comfort, fun,
keepsakes and ways to save. Every idea answers a specific detail in the brief (the month, the functions and
where they are, the guest count, meals, care needs, budget lines or the family's notes) and "because" names it.
Nothing generic that would suit any event. Keep costs realistic and inside the budget lines. Today is ${r.today}.`,
    user: `Event brief: ${clip(r.brief, 6000)}${
      r.avoid.length > 0
        ? `\nAlready on their ideas board, so suggest different ones: ${r.avoid.join("; ")}`
        : ""
    }`,
  };
}

/** One idea after cleaning. */
export type IdeaSuggestion = z.output<typeof idea>;

/** Keeps complete ideas only, none the board already has, and fails when nothing is left. */
export function sanitizeIdeas(raw: unknown, avoid: string[] = []): { ideas: IdeaSuggestion[] } {
  const seen = new Set(avoid.map((t) => t.toLowerCase()));
  const fresh = (s: IdeaSuggestion) => {
    const key = s.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const ideas = parseAnswer(ideasAnswer, raw).ideas.filter(fresh).slice(0, MAX_IDEAS);
  if (ideas.length === 0) throw new Error("No usable ideas");
  return { ideas };
}
