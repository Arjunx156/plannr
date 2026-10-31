import type { Kind } from "../data/baseTypes";
import type { Profile } from "../data/types";
import { addDays, parseDate, TODAY } from "./dates";
import { type DraftTask, type DraftVendor, timelineFor, vendorsFor } from "./draftLists";

export interface BudgetLine {
  name: string;
  amount: number;
  color: string;
  /** Why this share, when Gemini drafted the split. */
  why?: string;
}

export interface PlanDraft {
  title: string;
  kind: Kind;
  basis: string;
  /** The event day everything is dated against. */
  date: string;
  budget: { total: number; lines: BudgetLine[] };
  timeline: DraftTask[];
  tasks: number;
  vendors: DraftVendor[];
  vendorNote: string;
  guests: { total: number; groups: { name: string; count: number }[]; note?: string };
  ideas: string;
  /** Which parts Gemini drafted; the rest are Plannr's standard draft. */
  byGemini: { budget: boolean; timeline: boolean; vendors: boolean };
}

const SPLITS: Record<Kind, [string, number][]> = {
  wedding: [
    ["Catering", 0.25],
    ["Venue", 0.1778],
    ["Décor", 0.1333],
    ["Attire & jewellery", 0.1222],
    ["Photography & video", 0.1],
    ["Transport & stay", 0.0528],
    ["Entertainment", 0.05],
    ["Gifts & favours", 0.0389],
    ["Invitations", 0.025],
    ["Contingency", 0.05],
  ],
  birthday: [
    ["Food & snacks", 0.25],
    ["Décor", 0.225],
    ["Entertainer", 0.2],
    ["Cake", 0.1125],
    ["Return gifts", 0.1125],
    ["Contingency", 0.1],
  ],
  community: [
    ["Stalls & setup", 0.24],
    ["Sound & lighting", 0.2],
    ["Cultural night", 0.14],
    ["Lights & décor", 0.12],
    ["Security & sanitation", 0.1],
    ["Prizes & gifts", 0.06],
    ["Publicity & passes", 0.04],
    ["Permits & fees", 0.03],
    ["Contingency", 0.07],
  ],
  other: [
    ["Food", 0.3],
    ["Venue", 0.2],
    ["Décor", 0.15],
    ["Photos", 0.1],
    ["Entertainment", 0.08],
    ["Gifts", 0.07],
    ["Invitations", 0.03],
    ["Contingency", 0.07],
  ],
};

export const SPLIT_COLORS = ["#6E1F2E", "#D9962B", "#3D7A4F", "#1F5F6B", "#B5452B"];
const REST_COLOR = "#CFC5B4";

function roundTo(total: number): number {
  if (total >= 500000) return 5000;
  if (total >= 100000) return 1000;
  return 500;
}

export interface Share {
  name: string;
  /** Fraction of the total, 0 to 1. */
  share: number;
  why?: string;
}

/**
 * Amounts for each share of the total, rounded to a step that suits its size. The line at `sink`
 * absorbs the rounding, so the lines always add up to the total exactly.
 */
export function budgetLines(total: number, shares: Share[], sink = shares.length - 1): BudgetLine[] {
  const step = roundTo(total);
  const lines: BudgetLine[] = shares.map(({ name, share, why }, i) => ({
    name,
    amount: Math.round((total * share) / step) * step,
    color: SPLIT_COLORS[i] ?? REST_COLOR,
    ...(why ? { why } : {}),
  }));
  const drift = total - lines.reduce((s, l) => s + l.amount, 0);
  const absorber = lines[sink];
  if (absorber) absorber.amount += drift;
  return lines;
}

/** Split a budget by category for the event type. Lines always add up to the total. */
export function splitBudget(kind: Kind, total: number): BudgetLine[] {
  return budgetLines(
    total,
    SPLITS[kind].map(([name, share]) => ({ name, share })),
  );
}

export function countTasks(kind: Kind, functions: number, guests: number): number {
  if (kind === "wedding") return 45 + 6 * Math.max(1, functions) + (guests > 200 ? 2 : 0);
  if (kind === "birthday") return 18;
  if (kind === "community") return 30 + Math.min(24, Math.round(guests / 25));
  return 24;
}

/** How a guest list usually divides, by kind of event. */
const GUEST_SHARES: Record<Kind, [string, number][]> = {
  wedding: [
    ["Bride's side", 0.44],
    ["Groom's side", 0.4],
    ["Friends", 0.12],
    ["Colleagues", 0.04],
  ],
  birthday: [
    ["Kids", 0.6],
    ["Parents & family", 0.4],
  ],
  community: [
    ["Residents", 0.8],
    ["Visitors", 0.2],
  ],
  other: [
    ["Family", 0.6],
    ["Friends", 0.4],
  ],
};

/** The guest note: wheelchair needs first, then allergies, from what the family told Plannr. */
function guestNote(needs: string[]): string | undefined {
  const wheel = needs.find((n) => /wheelchair/i.test(n));
  if (wheel) {
    const count = wheel.match(/\d+/)?.[0];
    return `Step-free entry and ${count ? `${count} ` : ""}wheelchair spaces added to venue questions.`;
  }
  const allergy = needs.find((n) => /allerg/i.test(n));
  return allergy ? `Allergy notes collected on the RSVP form: ${allergy}.` : undefined;
}

function guestGroups(p: Profile, total: number): PlanDraft["guests"] {
  const groups = GUEST_SHARES[p.kind ?? "other"].map(([name, share]) => ({
    name,
    count: Math.round(total * share),
  }));
  // Rounding can leave the groups a guest or two off the total; the largest group absorbs it.
  const first = groups[0];
  if (first) first.count += total - groups.reduce((sum, g) => sum + g.count, 0);
  return { total, note: guestNote(p.needs), groups };
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

/** How the plan summary names the event: "Ananya & Rohan", "Aarav's birthday", "your event". */
export function planTitle(p: Profile): string {
  if (p.kind === "wedding") return p.names ?? "your wedding";
  if (p.kind === "birthday") return p.names ? `${p.names}'s birthday` : "the birthday";
  if (p.kind === "community") return "your community event";
  return "your event";
}

/** The colours ideas are drawn in: the family's own, else ones that suit the event. */
function ideaColours(p: Profile, kind: Kind): string {
  if (p.colours.length > 0) return p.colours.map((c) => c.toLowerCase()).join(" and ");
  if (kind === "wedding" && p.style === "Kerala-style") return "kasavu gold and ivory";
  return kind === "birthday" ? "the party theme" : "festive marigold and green";
}

/** What a draft assumes until the family says otherwise. */
const DEFAULT_BUDGET = 100000;
const DEFAULT_GUESTS = 50;
/** An event with no date yet is drafted for about three months out. */
const DEFAULT_LEAD_DAYS = 90;

/** The event's date, or the default lead time from today. */
export function draftDate(p: Profile): string {
  return p.date ?? addDays(TODAY, DEFAULT_LEAD_DAYS);
}

/** Plannr's standard draft: everything the plan summary shows, from the profile alone. */
export function draftPlan(p: Profile): PlanDraft {
  const kind = p.kind ?? "other";
  const total = p.budget ?? DEFAULT_BUDGET;
  const guests = p.guests ?? DEFAULT_GUESTS;
  const date = draftDate(p);
  const vendors = vendorsFor({ ...p, kind });
  const fnCount = p.functions.length;
  const basisBits = [
    `${guests} guests${p.city ? ` in ${p.city}` : ""}`,
    kind === "wedding" && fnCount > 1 ? `${NUMBER_WORDS[fnCount] ?? fnCount} functions` : undefined,
    parseDate(date).toLocaleString("en-IN", { month: "long" }),
  ].filter(Boolean);
  const priorities = p.priorities.map((x) => x.toLowerCase()).join(" · ");
  const colours = ideaColours(p, kind);
  return {
    title: planTitle(p),
    kind,
    basis: `Based on ${basisBits.join(", ")}${priorities ? `, and ${priorities} as priorities` : ""}.`,
    date,
    budget: { total, lines: splitBudget(kind, total) },
    timeline: timelineFor(kind, date, TODAY),
    tasks: countTasks(kind, fnCount, guests),
    vendors: vendors.list.map((name) => ({ name })),
    vendorNote: vendors.note,
    guests: guestGroups({ ...p, kind }, guests),
    ideas: `Ideas in ${colours}`,
    byGemini: { budget: false, timeline: false, vendors: false },
  };
}
