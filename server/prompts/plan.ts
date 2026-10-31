import { BadRequest, clip, int, isObject, isoDate, type Json, str, strList, VOICE } from "./kit";

// ---------------------------------------------------------------- plan draft

export interface PlanRequest {
  profile: unknown;
  plan: unknown;
  today: string;
  /** The event day the draft is dated against, when the draft names one. */
  date?: string;
}

export function planRequest(body: unknown): PlanRequest {
  if (!isObject(body) || !isObject(body.profile)) throw new BadRequest("profile is required");
  return {
    profile: body.profile,
    plan: body.plan ?? {},
    today: isoDate(body.today) ?? new Date().toISOString().slice(0, 10),
    date: isObject(body.plan) ? isoDate(body.plan.date) : undefined,
  };
}
const reason = { type: "string", description: "One short sentence on why, specific to this event" };

export const planSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two sentences on the shape of this plan" },
    budget: {
      type: "array",
      description:
        "The budget split for this event: four to ten categories whose percentages add up to exactly 100. Move money toward the family's priorities, what this city and month cost, the guest count and their needs. Keep a contingency line",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Category, reusing the draft's names where they fit" },
          percent: { type: "integer", description: "Whole percent of the total budget" },
          why: reason,
        },
        required: ["name", "percent", "why"],
      },
    },
    timeline: {
      type: "array",
      description:
        "Six to eight dated tasks from today to the event day, in order: what to book or decide first given lead times in this city and season, then invitations, the final headcount and the run sheet",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Starts with a verb, under ten words" },
          due: { type: "string", description: "YYYY-MM-DD, between today and the event date" },
          why: reason,
        },
        required: ["title", "due", "why"],
      },
    },
    vendors: {
      type: "array",
      description: "Four to twelve kinds of vendor this event needs to book, most urgent first",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Kind of vendor, e.g. 'Caterer' or 'Sound and lights'" },
          why: reason,
        },
        required: ["name", "why"],
      },
    },
    tips: {
      type: "array",
      description: "Three to five specific, actionable tips for this event, its city, season and priorities",
      items: {
        type: "object",
        properties: { title: { type: "string" }, detail: { type: "string" } },
        required: ["title", "detail"],
      },
    },
    watchouts: {
      type: "array",
      items: { type: "string" },
      description: "Up to three risks: weather for the month, lead times, budget pressure, accessibility",
    },
    ideas: {
      type: "array",
      items: { type: "string" },
      description: "Up to four short décor, food or experience ideas that fit the style and colours",
    },
  },
  required: ["summary", "tips", "budget", "timeline", "vendors"],
} as const;

export function planPrompt(r: PlanRequest): { system: string; user: string } {
  return {
    system: `${VOICE}
You draft an event plan the way an experienced local planner would: the budget split, the dated tasks from
now to the day, the vendors to book, and the advice that goes with them.
The draft you are given is Plannr's standard starting point for this kind of event. Tailor it to this event's
city, month, guest count, priorities, needs and traditions, and give a reason for every line.
Write in English, as the plan's screens are; the family's own words for things (sadhya, mehendi, muhurtham) are welcome.
Every number is checked before the family sees it: the percentages must add up to 100 and every date must fall
between today (${r.today}) and the event day${r.date ? ` (${r.date})` : ""}.`,
    user: `Event profile: ${clip(r.profile, 6000)}
Standard draft: ${clip(r.plan, 8000)}`,
  };
}

export interface PlanResult {
  summary: string;
  tips: { title: string; detail: string }[];
  watchouts: string[];
  ideas: string[];
  budget: { name: string; percent: number; why: string }[];
  timeline: { title: string; due: string; why: string }[];
  vendors: { name: string; why: string }[];
}
/** The model's rows that are objects, cleaned by `clean`, without the ones it rejects, capped at `max`. */
function rows<T>(v: unknown, max: number, clean: (row: Json) => T | undefined): T[] {
  const out: T[] = [];
  for (const row of Array.isArray(v) ? v.filter(isObject) : []) {
    const cleaned = clean(row);
    if (cleaned) out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}
function budgetRow(row: Json): PlanResult["budget"][number] | undefined {
  const name = str(row.name, 40);
  const percent = int(row.percent, 1, 90);
  return name && percent ? { name, percent, why: str(row.why, 160) ?? "" } : undefined;
}
function taskRow(row: Json): PlanResult["timeline"][number] | undefined {
  const title = str(row.title, 90);
  const due = isoDate(row.due);
  return title && due ? { title, due, why: str(row.why, 160) ?? "" } : undefined;
}
function vendorRow(row: Json): PlanResult["vendors"][number] | undefined {
  const name = str(row.name, 40);
  return name ? { name, why: str(row.why, 160) ?? "" } : undefined;
}

/** Cleans the draft's shape; whether the numbers hold together is checked in the browser (src/lib/plan.ts). */
export function sanitizePlan(raw: unknown): PlanResult {
  const r = isObject(raw) ? raw : {};
  const summary = str(r.summary, 600);
  if (!summary) throw new Error("Empty plan notes");
  const tips = rows(r.tips, 5, (t) => {
    const title = str(t.title, 80);
    const detail = str(t.detail, 320);
    return title && detail ? { title, detail } : undefined;
  });
  return {
    summary,
    tips,
    watchouts: strList(r.watchouts, 3, 240),
    ideas: strList(r.ideas, 4, 160),
    budget: rows(r.budget, 10, budgetRow),
    timeline: rows(r.timeline, 10, taskRow),
    vendors: rows(r.vendors, 12, vendorRow),
  };
}
