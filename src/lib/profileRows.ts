import type { Kind } from "../data/baseTypes";
import type { Profile } from "../data/types";
import type { QuestionField } from "./intakeQuestions";

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
/** "Kochi · 2 shortlisted", "Kochi · Grand Hyatt", or just the city while the venue is open. */
function venueLine(p: Profile): string | undefined {
  if (!p.venueStatus) return p.city;
  const twoShortlisted = p.venueStatus === "Shortlisted" && p.venues?.includes(" or ");
  const venue = twoShortlisted ? "2 shortlisted" : (p.venues ?? p.venueStatus.toLowerCase());
  return p.city ? `${p.city} · ${venue}` : venue;
}
/** A list as one line, or undefined when it's empty. */
const joined = (items: string[], sep: string) => (items.length > 0 ? items.join(sep) : undefined);

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
  const event = p.kind ? [KIND_LABEL[p.kind], p.style].filter(Boolean).join(" · ") : undefined;
  return [
    row("event", "Event", event, "kind"),
    row("functions", "Functions", joined(p.functions, ", "), "extras"),
    row("date", "Date", p.dateText, "date"),
    row("city", "City & venue", venueLine(p), p.city ? "venue" : "city"),
    row("guests", "Guests", p.guests ? `About ${p.guests}` : undefined, "guests"),
    row("budget", "Budget", p.budget ? `₹${p.budget.toLocaleString("en-IN")}` : undefined, "budget"),
    row("traditions", "Traditions", p.traditions, "extras"),
    row("needs", "Needs", joined(p.needs, " · "), "extras"),
    row("priorities", "Priorities", joined(p.priorities, " · "), "priorities"),
    row("co", "Co-planners", joined(p.coPlanners, ", "), undefined, "Next: who's planning with you"),
  ];
}
