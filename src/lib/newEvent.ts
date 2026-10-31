import type { FunctionDay, Hue, Kind, Task } from "../data/baseTypes";
import type { BudgetPlan, Category } from "../data/budgetTypes";
import type { PersonalEvent, Profile } from "../data/types";
import { addDays, longDate, shortDate } from "./dates";
import type { DraftTask } from "./draftLists";
import { slug } from "./format";
import { draftDate, type PlanDraft } from "./plan";
import { KIND_LABEL } from "./profileRows";

const HUE: Record<Kind, Hue> = {
  wedding: "marigold",
  birthday: "indigo",
  community: "leaf",
  other: "maroon",
};

const FUNCTION_OFFSET: Record<string, number> = {
  Engagement: -30,
  Mehendi: -3,
  Sangeet: -2,
  Haldi: -1,
  Ceremony: 0,
  Reception: 0,
};

export function eventName(p: Profile): string {
  if (p.kind === "wedding") return p.names ? `${p.names}'s wedding` : "Our wedding";
  if (p.kind === "birthday") return p.names ? `${p.names}'s birthday` : "Birthday party";
  if (p.kind === "community") return p.city ? `Community event, ${p.city}` : "Community event";
  return p.names ?? "New event";
}

/** Where the functions happen: the one named venue, else the city until a venue is chosen. */
function mainPlace(p: Profile): string {
  const oneVenue = p.venues && p.venues !== "Home" && !p.venues.includes(" or ");
  return oneVenue && p.venues ? p.venues : (p.city ?? "Venue to be chosen");
}

/** A ceremony on the same day as the reception is in the morning; the reception is in the evening. */
function functionPart(name: string, all: string[]): FunctionDay["part"] {
  if (name === "Reception") return "PM";
  return name === "Ceremony" && all.includes("Reception") ? "AM" : undefined;
}

/** One function per name the family gave, dated around the main day. A single function needs none. */
function draftFunctions(p: Profile, date: string, place: string): FunctionDay[] {
  if (p.functions.length < 2) return [];
  return p.functions.map((f) => ({
    id: f.toLowerCase(),
    label: f,
    date: addDays(date, FUNCTION_OFFSET[f] ?? 0),
    part: functionPart(f, p.functions),
    place,
  }));
}

/** The draft's timeline as the event's first tasks, each carrying the reason it's due when it is. */
function firstTasks(timeline: DraftTask[]): Task[] {
  return timeline.map((t, i) => ({
    id: `t${i + 1}`,
    title: t.title,
    who: "You",
    due: t.due,
    done: false,
    ...(t.why ? { note: t.why } : {}),
  }));
}

/** The what-if slider's range around the planned headcount. */
const WHAT_IF_RANGE = { min: 10, low: 0.4, high: 1.6 };

/** Ids for the budget lines: readable slugs, numbered when a name has none (any non-Latin script) or repeats one. */
function lineIds(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((name, i) => {
    const s = slug(name);
    const id = s && !seen.has(s) ? s : `line-${i + 1}`;
    seen.add(id);
    return id;
  });
}

/** The line that grows with the headcount: food, wherever the split put it. */
function cateringLine(categories: Category[]): Category | undefined {
  return categories.find((c) => /cater|food|sadhya|meal/i.test(c.name)) ?? categories[0];
}

/** The what-if headcount slider, priced from the catering line. */
function whatIfFor(guests: number | undefined, catering: Category | undefined): BudgetPlan["whatIf"] {
  if (!catering || !guests) return undefined;
  return {
    baseGuests: guests,
    min: Math.max(WHAT_IF_RANGE.min, Math.round(guests * WHAT_IF_RANGE.low)),
    max: Math.round(guests * WHAT_IF_RANGE.high),
    rates: [{ category: catering.name, perGuest: Math.round(catering.planned / guests) }],
  };
}

/** The draft's budget lines, each with nothing spent yet and the reason for its share as its note. */
function categoriesFrom(plan: PlanDraft): Category[] {
  const ids = lineIds(plan.budget.lines.map((l) => l.name));
  return plan.budget.lines.map((l, i) => ({
    id: ids[i] ?? `line-${i + 1}`,
    name: l.name,
    planned: l.amount,
    spent: 0,
    status: "Not started",
    tone: "idle",
    ...(l.why ? { note: l.why } : {}),
    items: [],
  }));
}

function budgetFrom(p: Profile, plan: PlanDraft): BudgetPlan {
  const categories = categoriesFrom(plan);
  const by = plan.byGemini.budget ? "Split drafted by Gemini for this event" : "Split suggested by Plannr";
  return {
    total: plan.budget.total,
    committed: 0,
    categories,
    payments: [],
    savings: [],
    whatIf: whatIfFor(p.guests, cateringLine(categories)),
    source: `${by}. ${plan.basis}`,
  };
}

/** The draft's vendors, all still needed, except a venue the family has already booked. */
function vendorsFrom(p: Profile, plan: PlanDraft): PersonalEvent["vendors"] {
  const names = plan.vendors.map((v) => v.name);
  const venueBooked = p.venueStatus === "Booked" && names.includes("Venue");
  return {
    booked: venueBooked ? ["Venue"] : [],
    talking: [],
    needed: names.filter((v) => !(venueBooked && v === "Venue")),
  };
}

/** The lines that describe the event in its header, in the nav and in the events list. */
function labelsFor(p: Profile, kind: Kind, date: string) {
  const where = p.venues === "Home" ? "at home" : (p.city ?? "");
  const line = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");
  return {
    eyebrow: line([KIND_LABEL[kind], p.city, longDate(date)]),
    navMeta: line([KIND_LABEL[kind], where, shortDate(date)]),
    listMeta: line([p.style, where, longDate(date), p.guests ? `${p.guests} guests` : undefined]),
  };
}

type FreshParts =
  | "role"
  | "morePeople"
  | "pace"
  | "budgetScore"
  | "budgetNote"
  | "notices"
  | "assistant"
  | "home";

/** What every new event starts with: nothing late, nothing spent, and the assistant's welcome. */
function freshParts(): Pick<PersonalEvent, FreshParts> {
  return {
    role: "OWNER",
    morePeople: 0,
    pace: "A fresh plan: nothing is late yet",
    budgetScore: 0.5,
    budgetNote: "nothing spent yet",
    notices: [],
    assistant: {
      intro: "",
      chips: ["What should I do this week?", "Why is readiness this low?", "Where are we over?"],
      thread: [
        {
          id: "welcome",
          role: "ai",
          text: "Your plan is live. Ask me anything about it, or tell me what to change. Nothing moves until you approve it.",
        },
      ],
    },
    home: {
      budgetNote: { text: "Nothing spent yet", tone: "idle" },
      readinessNote: { text: "First draft accepted", tone: "idle" },
    },
  };
}

/**
 * The accepted draft becomes a live event with an empty ledger, its budget lines and its dated tasks,
 * Gemini's where they passed the checks in tailor.ts. The family's needs and traditions become
 * standing notes every later suggestion respects, and the ideas Gemini wrote start the ideas board.
 */
export function eventFromDraft(
  p: Profile,
  plan: PlanDraft,
  user: { name: string; initials: string },
  existing?: { id: string; name: string },
  ideas: string[] = [],
): PersonalEvent {
  const kind = p.kind ?? "other";
  const date = draftDate(p);
  const name = existing?.name ?? eventName(p);
  const place = mainPlace(p);
  const guests = p.guests ?? 0;
  const wedding = kind === "wedding";
  return {
    ...freshParts(),
    // Ids are shared by every account on the server, so the suffix is random rather than a timestamp.
    id: existing?.id ?? `${slug(name)}-${crypto.randomUUID().slice(0, 8)}`,
    kind,
    layout: "personal",
    name,
    hue: HUE[kind],
    ...labelsFor(p, kind, date),
    date,
    guests,
    countdown: {
      label: wedding ? "Countdown to the wedding" : "Countdown to the day",
      line: `${longDate(date)} · ${place}`,
      theme: wedding ? "maroon" : "indigo",
    },
    functions: draftFunctions(p, date, place),
    memory: [...p.needs, ...(p.traditions ? [p.traditions] : [])].map((text, i) => ({
      id: `m${i + 1}`,
      text,
    })),
    ideas: ideas.map((title, i) => ({
      id: `i${i + 1}`,
      title,
      status: "idea",
      note: "From Plannr's first draft",
    })),
    people: [{ initials: user.initials, bg: "#1F5F6B", fg: "#FFFFFF", name: user.name }],
    budget: budgetFrom(p, plan),
    tasks: { total: plan.tasks, doneBefore: 0, list: firstTasks(plan.timeline) },
    vendors: vendorsFrom(p, plan),
    rsvp: { total: guests, invited: 0, confirmed: 0, declined: 0, pending: 0, notSent: guests },
  };
}
