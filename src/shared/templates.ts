import type { PlannrEvent } from "../data/types";
import { addDays, daysBetween } from "../lib/dates";

/**
 * Templates: a finished event saved as the start of the next one. Next year's mela begins
 * with this year's tasks, vendors, volunteers and real costs, with every answer, payment
 * and photo cleared, and every date moved to the new day.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Moves every date in a plan by the same number of days. */
export function shiftDates<T>(value: T, days: number): T {
  if (!days) return value;
  if (typeof value === "string") return (ISO.test(value) ? addDays(value, days) : value) as T;
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = shiftDates(v, days);
    return out as T;
  }
  return value;
}

/** What carries over: the shape of the plan and what it cost, not what happened. */
export function toTemplate(ev: PlannrEvent): PlannrEvent {
  const copy = structuredClone(ev);
  if (copy.layout === "empty") return copy;
  copy.archived = undefined;
  copy.tasks = {
    total: copy.tasks.list.length,
    doneBefore: 0,
    list: copy.tasks.list.map((t) => ({ ...t, done: false })),
  };
  copy.notices = [];
  copy.assistant = { ...copy.assistant, thread: [] };
  copy.announcements = [];
  copy.album = [];
  copy.gifts = [];
  copy.households = (copy.households ?? []).map((h) => ({
    ...h,
    rsvp: {},
    checkedIn: undefined,
    invitedAt: undefined,
    remindedAt: undefined,
    respondedAt: undefined,
    note: undefined,
    tables: undefined,
  }));
  copy.runsheet = (copy.runsheet ?? []).map((r) => ({ ...r, done: false }));
  copy.checklist = (copy.checklist ?? []).map((c) => ({ ...c, done: false }));
  copy.site = copy.site ? { ...copy.site, published: false } : undefined;
  copy.vendorList = (copy.vendorList ?? []).map((v) => ({
    ...v,
    // Last time's vendors are a shortlist to call again, with what they charged.
    stage: v.name ? ("enquired" as const) : ("needed" as const),
    chosenQuote: undefined,
    quotes: v.quotes.map((q) => ({ ...q, label: `Last time: ${q.label.replace(/^Last time: /, "")}` })),
  }));
  if (copy.layout === "personal") {
    copy.budget = {
      ...copy.budget,
      committed: 0,
      categories: copy.budget.categories.map((c) => ({
        ...c,
        // What it really cost becomes this time's plan.
        planned: Math.max(c.spent, c.projected ?? c.planned),
        spent: 0,
        projected: undefined,
        status: "Last time's cost",
        tone: "idle" as const,
        items: c.items.map((i) => ({ ...i, status: "quote" as const, estimate: true })),
      })),
      payments: [],
      split: copy.budget.split
        ? {
            ...copy.budget.split,
            sides: copy.budget.split.sides.map((s) => ({ ...s, paid: 0 })),
            settlements: [],
          }
        : undefined,
      dueSoon: [],
    };
  } else {
    copy.funds = {
      ...copy.funds,
      spent: 0,
      sources: copy.funds.sources.map((s) => ({
        ...s,
        received: 0,
        note: "to collect",
        tone: "idle" as const,
      })),
      approvals: [],
    };
    copy.stallList = (copy.stallList ?? []).map((s) => ({ ...s, paid: false, status: "requested" as const }));
    copy.sponsors = (copy.sponsors ?? []).map((s) => ({ ...s, received: 0 }));
    copy.passList = [];
    copy.passes = { ...copy.passes, issued: 0 };
    copy.permits = copy.permits.map((p) => ({
      ...p,
      status: p.permit ? "To apply" : "To book",
      tone: "idle" as const,
      letter: undefined,
    }));
    copy.shifts = {
      ...copy.shifts,
      roles: copy.shifts.roles.map((r) => ({ ...r, slots: r.slots.map((s) => ({ ...s, names: [] })) })),
    };
  }
  return copy;
}

/** A new event from a template, on a new date. */
export function fromTemplate(
  template: PlannrEvent,
  opts: { id: string; name: string; date: string },
): PlannrEvent {
  const days = daysBetween(template.date, opts.date);
  const moved = shiftDates(template, days);
  return { ...moved, id: opts.id, name: opts.name, date: opts.date };
}
