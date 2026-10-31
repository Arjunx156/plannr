import type { Kind } from "../data/baseTypes";
import type { Profile } from "../data/types";

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
const OTHER_EXTRAS = "Anything else: segments of the day, permits you know about, or accessibility needs?";
const EXTRAS_PROMPT: Record<Kind, string> = {
  wedding: "Any other functions, traditions or accessibility needs I should plan around?",
  birthday: "Any allergies, a theme, or anything the kids will remember?",
  community: OTHER_EXTRAS,
  other: OTHER_EXTRAS,
};

/** Most priorities a planner can pick: with more than three, nothing is a priority. */
export const MAX_PRIORITIES = 3;

/** Adds or removes one priority or cut; adding a fourth priority does nothing. */
export function togglePick(current: string[], option: string, list: "priorities" | "cuts"): string[] {
  if (current.includes(option)) return current.filter((x) => x !== option);
  if (list === "priorities" && current.length >= MAX_PRIORITIES) return current;
  return [...current, option];
}

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
      prompt: EXTRAS_PROMPT[p.kind],
    };
  if (!asked.has("priorities"))
    return {
      field: "priorities",
      prompt: "What matters most? Pick up to three, and anything you'd cut first if money gets tight.",
    };
  return null;
}
