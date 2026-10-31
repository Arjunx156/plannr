import type { PlannrEvent } from "../data/types";
import { daysBetween } from "../lib/dates";
import type { EventAction } from "./engine";

/**
 * What needs the planner's attention, worked out from the plan each time it's opened.
 * Every line quotes the plan's own numbers, and every button does something real: it
 * opens the right page, previews a change, or makes one the planner can undo.
 */

export type WatchAction =
  | { label: string; kind: "go"; to: string }
  | { label: string; kind: "headcount"; guests: number }
  | { label: string; kind: "apply"; actions: EventAction[]; done: string };

/** One notice on the overview: what's wrong, how soon, and what to do about it. */
export interface Watch {
  /** Changes when the situation does, so a dismissed notice comes back if it gets worse. */
  id: string;
  tone: "warn" | "ai" | "info";
  label: string;
  text: string;
  why?: string | undefined;
  primary?: WatchAction | undefined;
  secondary?: WatchAction | undefined;
  /** Lower is more urgent. */
  rank: number;
}
/** Whole weeks from today until a date, never negative. */
export const weeksTo = (today: string, date: string): number =>
  Math.max(0, Math.round(daysBetween(today, date) / 7));
/** A date as a notice says it: "today", "tomorrow", "in 3 days". */
export const whenText = (today: string, date: string): string => {
  const d = daysBetween(today, date);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 14) return `in ${d} days`;
  return `in ${weeksTo(today, date)} weeks`;
};
/** One kind of notice: what it finds in the plan, or nothing. */
export type Rule<E> = (ev: E, today: string) => Watch[];
/** The path to one tab of an event. */
export const eventPath = (ev: PlannrEvent, tab: string) => `/events/${ev.id}/${tab}`;
/** The ids of a list, joined: changes whenever the list does, so a dismissed notice can come back. */
export const ids = (items: { id?: string }[]): string => items.map((x) => x.id).join(",");
