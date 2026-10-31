import type { Profile } from "../data/types";
import { TODAY } from "./dates";
import type { DraftTask, DraftVendor } from "./draftLists";
import { type BudgetLine, budgetLines, draftPlan, type PlanDraft } from "./plan";

/**
 * What Gemini sends back for a draft (`sanitizePlan` in server/prompts/plan.ts): its notes, plus its own
 * budget split, dated tasks and vendors for this event. The three lists are optional because drafts
 * saved before Gemini drafted them, and test doubles, don't carry them.
 */
export interface PlanNotes {
  summary: string;
  tips: { title: string; detail: string }[];
  watchouts: string[];
  ideas: string[];
  budget?: { name: string; percent: number; why: string }[];
  timeline?: { title: string; due: string; why: string }[];
  vendors?: { name: string; why: string }[];
}

/** Gemini is asked for percentages that add up to 100; a little slack covers rounding, nothing more. */
const PERCENT_TOTAL = { min: 95, max: 105 };
const LINES = { min: 3, max: 10 };
const TASKS = { min: 3, max: 8 };
const VENDORS = { min: 3, max: 12 };
const CONTINGENCY = /contingency|buffer|reserve|miscellaneous/i;

/** The first row for each name, ignoring case, so "Catering" and "catering" can't both take a share. */
function unique<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = key(row).trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Gemini's split as amounts that add up to the total exactly, largest first with the contingency
 * last, or undefined when the percentages don't hold together.
 */
export function geminiBudget(
  total: number,
  proposed: NonNullable<PlanNotes["budget"]>,
): BudgetLine[] | undefined {
  const rows = unique(proposed, (r) => r.name).filter((r) => r.percent > 0);
  const sum = rows.reduce((s, r) => s + r.percent, 0);
  if (rows.length < LINES.min || rows.length > LINES.max) return undefined;
  if (sum < PERCENT_TOTAL.min || sum > PERCENT_TOTAL.max) return undefined;
  const ordered = [...rows].sort(
    (a, b) => Number(CONTINGENCY.test(a.name)) - Number(CONTINGENCY.test(b.name)) || b.percent - a.percent,
  );
  const shares = ordered.map((r) => ({ name: r.name, share: r.percent / sum, why: r.why }));
  const contingency = ordered.findIndex((r) => CONTINGENCY.test(r.name));
  const lines = budgetLines(total, shares, contingency >= 0 ? contingency : 0);
  return lines.every((l) => l.amount > 0) ? lines : undefined;
}

function clampDate(iso: string, from: string, to: string): string {
  if (iso < from) return from;
  return iso > to ? to : iso;
}

/** Gemini's tasks in date order, each due between today and the day, or undefined when too few survive. */
export function geminiTimeline(
  proposed: NonNullable<PlanNotes["timeline"]>,
  today: string,
  date: string,
): DraftTask[] | undefined {
  const last = date > today ? date : today;
  const tasks = unique(proposed, (t) => t.title)
    .map((t) => ({ title: t.title, due: clampDate(t.due, today, last), ...(t.why ? { why: t.why } : {}) }))
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, TASKS.max);
  return tasks.length >= TASKS.min ? tasks : undefined;
}

/** Gemini's vendors without repeats, or undefined when too few are left to be a checklist. */
export function geminiVendors(proposed: NonNullable<PlanNotes["vendors"]>): DraftVendor[] | undefined {
  const vendors = unique(proposed, (v) => v.name)
    .slice(0, VENDORS.max)
    .map((v) => ({ name: v.name, ...(v.why ? { why: v.why } : {}) }));
  return vendors.length >= VENDORS.min ? vendors : undefined;
}

/**
 * The draft with Gemini's budget, timeline and vendors wherever they pass the checks above. Each part
 * falls back to Plannr's standard draft on its own, and `byGemini` says which is which.
 */
export function tailorPlan(base: PlanDraft, notes: PlanNotes | undefined, today = TODAY): PlanDraft {
  if (!notes) return base;
  const lines = geminiBudget(base.budget.total, notes.budget ?? []);
  const timeline = geminiTimeline(notes.timeline ?? [], today, base.date);
  const vendors = geminiVendors(notes.vendors ?? []);
  return {
    ...base,
    budget: lines ? { total: base.budget.total, lines } : base.budget,
    timeline: timeline ?? base.timeline,
    vendors: vendors ?? base.vendors,
    byGemini: { budget: !!lines, timeline: !!timeline, vendors: !!vendors },
  };
}

/** The plan for a draft profile and whatever Gemini wrote for it. */
export function planFor(profile: Profile, notes?: PlanNotes): PlanDraft {
  return tailorPlan(draftPlan(profile), notes);
}
