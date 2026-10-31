import { z } from "zod";
import {
  calendarDay,
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

// ---------------------------------------------------------------- plan draft

/** Plannr's standard draft, passed on whole; its event day, when it names one, is what the tasks are dated against. */
const draft = z.looseObject({ date: maybe(calendarDay()) }).catch({});

const planBody = requestBody(
  { profile: record("profile is required"), plan: draft, today: requestDate() },
  "profile is required",
);

/** A plan request: the profile, Plannr's standard draft and today's date. */
export type PlanRequest = z.output<typeof planBody>;

/** Checks a plan request; throws BadRequest when the profile is missing. */
export function planRequest(raw: unknown): PlanRequest {
  return parseRequest(planBody, raw);
}

// Asked for on every line, but a line without its reason is still worth keeping.
const reason = text(160).catch("").describe("One short sentence on why, specific to this event");

const budgetLine = z.object({
  name: text(40).describe("Category, reusing the draft's names where they fit"),
  percent: whole(1, 90).describe("Whole percent of the total budget"),
  why: reason,
});

const task = z.object({
  title: text(90).describe("Starts with a verb, under ten words"),
  due: calendarDay().describe("YYYY-MM-DD, between today and the event date"),
  why: reason,
});

const vendor = z.object({
  name: text(40).describe("Kind of vendor, e.g. 'Caterer' or 'Sound and lights'"),
  why: reason,
});

const tip = z.object({ title: text(80), detail: text(320) });

/** Gemini's notes on a draft, as it sends them and as they're cleaned. */
const planAnswer = z.object({
  summary: text(600).describe("Two sentences on the shape of this plan"),
  budget: rows(budgetLine, 10).describe(
    "The budget split for this event: four to ten categories whose percentages add up to exactly 100. Move money toward the family's priorities, what this city and month cost, the guest count and their needs. Keep a contingency line",
  ),
  timeline: rows(task, 10).describe(
    "Six to eight dated tasks from today to the event day, in order: what to book or decide first given lead times in this city and season, then invitations, the final headcount and the run sheet",
  ),
  vendors: rows(vendor, 12).describe(
    "Four to twelve kinds of vendor this event needs to book, most urgent first",
  ),
  tips: rows(tip, 5).describe(
    "Three to five specific, actionable tips for this event, its city, season and priorities",
  ),
  watchouts: texts(3, 240)
    .default([])
    .describe("Up to three risks: weather for the month, lead times, budget pressure, accessibility"),
  ideas: texts(4, 160)
    .default([])
    .describe("Up to four short décor, food or experience ideas that fit the style and colours"),
});

/** The JSON schema for Gemini's notes on a draft. */
export const planSchema: JsonSchema = geminiSchema(planAnswer);

/** The plan prompt: tailor the standard draft to this family, keeping its shape. */
export function planPrompt(r: PlanRequest): { system: string; user: string } {
  return {
    system: `${VOICE}
You draft an event plan the way an experienced local planner would: the budget split, the dated tasks from
now to the day, the vendors to book, and the advice that goes with them.
The draft you are given is Plannr's standard starting point for this kind of event. Tailor it to this event's
city, month, guest count, priorities, needs and traditions, and give a reason for every line.
Write in English, as the plan's screens are; the family's own words for things (sadhya, mehendi, muhurtham) are welcome.
Every number is checked before the family sees it: the percentages must add up to 100 and every date must fall
between today (${r.today}) and the event day${r.plan.date ? ` (${r.plan.date})` : ""}.`,
    user: `Event profile: ${clip(r.profile, 6000)}
Standard draft: ${clip(r.plan, 8000)}`,
  };
}

/** Gemini's notes on a draft, after cleaning. */
export type PlanResult = z.output<typeof planAnswer>;

/** Cleans the draft's shape; whether the numbers hold together is checked in the browser (src/lib/plan.ts). */
export function sanitizePlan(raw: unknown): PlanResult {
  return parseAnswer(planAnswer, raw, "Empty plan notes");
}
