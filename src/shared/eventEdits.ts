import type { Category, CommunityEvent, Message, PersonalEvent, PlannrEvent, Task } from "../data/types";
import { findRecord, patch as patchRecord, upsert, vendorsOf } from "./records";

/**
 * Small immutable updates shared by the plan's reducers. Each returns a new event and
 * leaves the one it was given untouched, so history can replay them.
 */

/** An event that has a plan: tasks, notices and an assistant thread. */
export type PlannedEvent = PersonalEvent | CommunityEvent;

/** Runs `fn` on a personal event (wedding, birthday); any other event comes back as it was. */
export function onPersonal(ev: PlannrEvent, fn: (e: PersonalEvent) => PersonalEvent): PlannrEvent {
  return ev.layout === "personal" ? fn(ev) : ev;
}

/** Runs `fn` on a community event; any other event comes back as it was. */
export function onCommunity(ev: PlannrEvent, fn: (e: CommunityEvent) => CommunityEvent): PlannrEvent {
  return ev.layout === "community" ? fn(ev) : ev;
}

/** Runs `fn` on any event that has a plan; an empty event comes back as it was. */
export function onPlanned(ev: PlannrEvent, fn: <E extends PlannedEvent>(e: E) => E): PlannrEvent {
  return ev.layout === "empty" ? ev : fn(ev);
}

/** Rewrites the task list, adding `added` to the running total of tasks ever created. */
export function withTasks<E extends PlannedEvent>(ev: E, fn: (list: Task[]) => Task[], added = 0): E {
  return { ...ev, tasks: { ...ev.tasks, total: ev.tasks.total + added, list: fn(ev.tasks.list) } };
}

/** Appends tasks the plan doesn't have yet, counting only the ones actually added. */
export function addTasks<E extends PlannedEvent>(ev: E, tasks: Task[]): E {
  const fresh = tasks.filter((t) => !ev.tasks.list.some((x) => x.id === t.id));
  return fresh.length ? withTasks(ev, (list) => [...list, ...fresh], fresh.length) : ev;
}

/** Marks one task done. */
export function completeTask<E extends PlannedEvent>(ev: E, taskId: string): E {
  return withTasks(ev, (list) => list.map((t) => (t.id === taskId ? { ...t, done: true } : t)));
}

/** Rewrites one budget category. */
export function withCategory(ev: PersonalEvent, id: string, fn: (c: Category) => Category): PersonalEvent {
  return {
    ...ev,
    budget: { ...ev.budget, categories: ev.budget.categories.map((c) => (c.id === id ? fn(c) : c)) },
  };
}

/** Adds `amount` to a category's projected spend (its plan when nothing is projected yet). */
export function raiseProjection(ev: PersonalEvent, id: string, amount: number): PersonalEvent {
  return withCategory(ev, id, (c) => ({ ...c, projected: (c.projected ?? c.planned) + amount }));
}

/** Closes a notice as handled, with the line that says what was done. */
export function resolveNotice<E extends PlannedEvent>(ev: E, noticeId: string, result: string): E {
  return {
    ...ev,
    notices: ev.notices.map((n) => (n.id === noticeId ? { ...n, status: "done" as const, result } : n)),
  };
}

/** Rewrites the assistant thread. */
export function withThread<E extends PlannedEvent>(ev: E, fn: (t: Message[]) => Message[]): E {
  return { ...ev, assistant: { ...ev.assistant, thread: fn(ev.assistant.thread) } };
}

/** Moves a vendor category from "talking" to "booked" on a personal event's summary. */
export function markBooked(ev: PersonalEvent, category: string): PersonalEvent {
  const { booked, talking } = ev.vendors;
  return {
    ...ev,
    vendors: {
      ...ev.vendors,
      booked: booked.includes(category) ? booked : [...booked, category],
      talking: talking.filter((v) => v !== category),
    },
  };
}

/** Marks a vendor category booked in the vendor list, adding it if the list doesn't have it. */
export function bookCategory<E extends PlannrEvent>(ev: E, category: string, name: string): E {
  const id = category.toLowerCase();
  const vendor = vendorsOf(ev).find((x) => x.category === category);
  if (vendor) return patchRecord(ev, "vendors", vendor.id, { stage: "booked", name: vendor.name || name });
  if (findRecord(ev, "vendors", id)) return ev;
  return upsert(ev, "vendors", { id, category, name, stage: "booked", quotes: [] });
}

/** Longest event name Plannr keeps. */
export const MAX_EVENT_NAME = 120;

/** A trimmed, length-capped event name; a blank one keeps the current name. */
export function eventName(raw: string | undefined, current: string): string {
  return raw?.trim().slice(0, MAX_EVENT_NAME) || current;
}
