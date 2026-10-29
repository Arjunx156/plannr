import type { Household, Meal, PayMethod, PlannrEvent, RsvpStatus, SiteInfo } from "../data/types";
import { addDays, dayMonth, longDate } from "../lib/dates";
import { inr } from "../lib/format";
import {
  type AnyRecord,
  type Coll,
  findRecord,
  functionsOf,
  list,
  patch,
  recordName,
  remove,
  setList,
  upsert,
} from "./records";

/**
 * Changes to the plan's records: guests, vendors, money, the day's run sheet and the
 * community lists. Each is pure, so history can replay it, and idempotent where a
 * repeat could arrive (an RSVP sent twice, a payment marked paid on two phones).
 */
export type PlanAction =
  | { type: "addRecord"; eventId: string; coll: Coll; record: AnyRecord }
  | { type: "updateRecord"; eventId: string; coll: Coll; id: string; patch: Record<string, unknown> }
  | { type: "removeRecord"; eventId: string; coll: Coll; id: string }
  | {
      type: "rsvp";
      eventId: string;
      householdId: string;
      answers: Record<string, { status: RsvpStatus; count: number }>;
      meal?: Meal;
      stay?: boolean;
      pickup?: string;
      note?: string;
      at?: string;
    }
  | {
      type: "markPaid";
      eventId: string;
      paymentId: string;
      paid: boolean;
      on?: string;
      method?: PayMethod;
      by?: string;
    }
  | {
      type: "checkIn";
      eventId: string;
      coll: "households" | "passes";
      id: string;
      fnId: string;
      count: number;
    }
  | { type: "shiftRunsheet"; eventId: string; fnId: string; fromId: string; minutes: number }
  | { type: "setHeadcount"; eventId: string; guests: number }
  | { type: "bookVendor"; eventId: string; vendorId: string; quoteId?: string }
  | {
      type: "editShifts";
      eventId: string;
      op: "addRole" | "setNeed" | "unassign" | "addVolunteer";
      role?: string;
      slot?: number;
      need?: number;
      name?: string;
    }
  | {
      type: "updateEvent";
      eventId: string;
      patch: { name?: string; date?: string; site?: SiteInfo; listMeta?: string };
    };

export const PLAN_ACTION_TYPES: PlanAction["type"][] = [
  "addRecord",
  "updateRecord",
  "removeRecord",
  "rsvp",
  "markPaid",
  "checkIn",
  "shiftRunsheet",
  "setHeadcount",
  "bookVendor",
  "editShifts",
  "updateEvent",
];

/** Check-ins happen by the hundred on the day; they're saved but stay out of history. */
export const QUIET_PLAN_ACTIONS: PlanAction["type"][] = ["checkIn"];

/** "09:45" + 8 → "09:53", kept within the day. */
export function addMinutes(time: string, minutes: number): string {
  const [h = "0", m = "0"] = time.split(":");
  const total = Math.min(23 * 60 + 59, Math.max(0, Number(h) * 60 + Number(m) + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Fills in the time-dependent parts of an action when it's made, so replays agree. */
export function stampPlanAction(action: PlanAction, today: string, now: string): PlanAction {
  switch (action.type) {
    case "rsvp":
      return action.at ? action : { ...action, at: now };
    case "markPaid":
      return action.paid && !action.on ? { ...action, on: today } : action;
    case "addRecord":
      if (
        (action.coll === "announcements" || action.coll === "album") &&
        !("at" in action.record && action.record.at)
      )
        return { ...action, record: { ...action.record, at: now } as typeof action.record };
      return action;
    default:
      return action;
  }
}

export function applyPlanAction(ev: PlannrEvent, action: PlanAction): PlannrEvent {
  if (ev.layout === "empty" && action.type !== "updateEvent") return ev;
  switch (action.type) {
    case "addRecord":
      return upsert(ev, action.coll, action.record);
    case "updateRecord":
      return patch(ev, action.coll, action.id, action.patch as Partial<AnyRecord>);
    case "removeRecord":
      return remove(ev, action.coll, action.id);
    case "rsvp": {
      const h = findRecord(ev, "households", action.householdId);
      if (!h) return ev;
      const answers: typeof h.rsvp = { ...h.rsvp };
      // Only functions they're invited to, and never more people than invited plus two.
      for (const [fnId, a] of Object.entries(action.answers))
        if (h.functions.includes(fnId))
          answers[fnId] = {
            status: a.status,
            count: a.status === "yes" ? Math.max(1, Math.min(a.count, h.expected + 2)) : 0,
          };
      return patch(ev, "households", h.id, {
        rsvp: answers,
        meal: action.meal ?? h.meal,
        stay: action.stay ?? h.stay,
        pickup: action.pickup ?? h.pickup,
        note: action.note ?? h.note,
        respondedAt: action.at ?? h.respondedAt,
      });
    }
    case "markPaid": {
      if (ev.layout !== "personal") return ev;
      const p = findRecord(ev, "payments", action.paymentId);
      if (!p || p.paid === action.paid) return ev;
      const sign = action.paid ? 1 : -1;
      let next: PlannrEvent = patch(ev, "payments", p.id, {
        paid: action.paid,
        paidOn: action.paid ? action.on : undefined,
        method: action.paid ? action.method : undefined,
        by: action.paid ? (action.by ?? p.by) : p.by,
      });
      if (p.categoryId) {
        const c = findRecord(next, "categories", p.categoryId);
        if (c) next = patch(next, "categories", c.id, { spent: Math.max(0, c.spent + sign * p.amount) });
      }
      const by = action.paid ? (action.by ?? p.by) : p.by;
      if (by && next.layout === "personal" && next.budget.split) {
        const split = next.budget.split;
        next = {
          ...next,
          budget: {
            ...next.budget,
            split: {
              ...split,
              sides: split.sides.map((s) =>
                s.name === by ? { ...s, paid: Math.max(0, s.paid + sign * p.amount) } : s,
              ),
            },
          },
        };
      }
      return next;
    }
    case "checkIn": {
      const count = Math.max(0, Math.round(action.count));
      if (action.coll === "households") {
        const h = findRecord(ev, "households", action.id);
        return h
          ? patch(ev, "households", h.id, { checkedIn: { ...h.checkedIn, [action.fnId]: count } })
          : ev;
      }
      return findRecord(ev, "passes", action.id) ? patch(ev, "passes", action.id, { checkedIn: count }) : ev;
    }
    case "shiftRunsheet": {
      const items = list(ev, "runsheet");
      const from = items.find((i) => i.id === action.fromId);
      if (!from || !action.minutes) return ev;
      return setList(
        ev,
        "runsheet",
        items.map((i) =>
          i.fnId === action.fnId && i.time >= from.time && !i.done
            ? { ...i, time: addMinutes(i.time, action.minutes) }
            : i,
        ),
      );
    }
    case "setHeadcount":
      return ev.layout === "personal" ? { ...ev, guests: Math.max(1, Math.round(action.guests)) } : ev;
    case "bookVendor": {
      const v = findRecord(ev, "vendors", action.vendorId);
      if (!v) return ev;
      return patch(ev, "vendors", v.id, { stage: "booked", chosenQuote: action.quoteId ?? v.chosenQuote });
    }
    case "editShifts": {
      if (ev.layout !== "community") return ev;
      const { op, role = "", slot = -1, name = "" } = action;
      const shifts = ev.shifts;
      if (op === "addVolunteer")
        return name && !ev.volunteers.includes(name) ? { ...ev, volunteers: [...ev.volunteers, name] } : ev;
      if (op === "addRole")
        return role && !shifts.roles.some((r) => r.role.toLowerCase() === role.toLowerCase())
          ? {
              ...ev,
              shifts: {
                ...shifts,
                roles: [...shifts.roles, { role, slots: shifts.slots.map(() => ({ need: 2, names: [] })) }],
              },
            }
          : ev;
      const roles = shifts.roles.map((r) =>
        r.role !== role
          ? r
          : {
              ...r,
              slots: r.slots.map((s, i) => {
                if (i !== slot) return s;
                if (op === "setNeed")
                  return { ...s, need: Math.max(0, Math.min(99, Math.round(action.need ?? s.need))) };
                return { ...s, names: s.names.filter((n) => n !== name) };
              }),
            },
      );
      return { ...ev, shifts: { ...shifts, roles } };
    }
    case "updateEvent": {
      const p = action.patch;
      return {
        ...ev,
        ...(p.name?.trim() ? { name: p.name.trim().slice(0, 120) } : {}),
        ...(p.date ? { date: p.date } : {}),
        ...(p.listMeta ? { listMeta: p.listMeta } : {}),
        ...(p.site && ev.layout !== "empty" ? { site: { ...ev.site, ...p.site } } : {}),
      } as PlannrEvent;
    }
  }
}

const q = (s: string) => `“${s}”`;

/** A history line for a plan change, worded from the plan as it was before the change. */
export function describePlanAction(action: PlanAction, ev: PlannrEvent): string {
  switch (action.type) {
    case "addRecord": {
      const r = action.record;
      if (action.coll === "memory" && "text" in r) return `Plannr will remember ${q(r.text)}`;
      if (action.coll === "announcements" && "text" in r) return `Announced ${q(r.text)}`;
      if (action.coll === "households") {
        const h = r as Household;
        return `Added the household ${q(h.name)} (${h.expected})`;
      }
      if (action.coll === "payments" && "amount" in r && "label" in r)
        return `Scheduled ${inr(r.amount)}: ${q(r.label)}`;
      const exists = findRecord(ev, action.coll, r.id);
      return `${exists ? "Updated" : "Added"} ${recordName(action.coll, r)}`;
    }
    case "updateRecord": {
      const before = findRecord(ev, action.coll, action.id);
      const changes = action.patch;
      if (action.coll === "vendors" && typeof changes.stage === "string")
        return `Moved ${recordName("vendors", before)} to ${changes.stage}`;
      if (action.coll === "functions" && typeof changes.date === "string")
        return `Moved ${recordName("functions", before)} to ${longDate(changes.date)}`;
      if (action.coll === "categories" && typeof changes.planned === "number")
        return `Set ${recordName("categories", before)} to ${inr(changes.planned)}`;
      if (action.coll === "approvals" && typeof changes.status === "string")
        return `${changes.status === "approved" ? "Approved" : "Declined"} ${recordName("approvals", before)}`;
      if (("done" in changes || "thanked" in changes) && Object.keys(changes).length === 1)
        return `${changes.done || changes.thanked ? "Ticked off" : "Reopened"} ${recordName(action.coll, before)}`;
      return `Updated ${recordName(action.coll, before)}`;
    }
    case "removeRecord":
      return `Removed ${recordName(action.coll, findRecord(ev, action.coll, action.id))}`;
    case "rsvp": {
      const h = findRecord(ev, "households", action.householdId);
      const fns = functionsOf(ev);
      const going = Object.entries(action.answers)
        .filter(([, a]) => a.status === "yes")
        .map(([id]) => fns.find((f) => f.id === id)?.label ?? id);
      const notGoing = Object.entries(action.answers)
        .filter(([, a]) => a.status === "no")
        .map(([id]) => fns.find((f) => f.id === id)?.label ?? id);
      const people = Math.max(
        0,
        ...Object.values(action.answers).map((a) => (a.status === "yes" ? a.count : 0)),
      );
      const who = h?.name ?? "A household";
      if (!going.length)
        return h && notGoing.length < h.functions.length
          ? `${who} can't come to ${notGoing.join(", ")}`
          : `${who} can't come`;
      return `${who} replied: ${people} coming to ${going.join(", ")}${notGoing.length ? `, not ${notGoing.join(", ")}` : ""}`;
    }
    case "markPaid": {
      const p = findRecord(ev, "payments", action.paymentId);
      if (!p) return "Changed a payment";
      return action.paid ? `Paid ${inr(p.amount)}: ${q(p.label)}` : `Marked ${q(p.label)} as not paid`;
    }
    case "checkIn": {
      const r =
        action.coll === "households"
          ? findRecord(ev, "households", action.id)
          : findRecord(ev, "passes", action.id);
      return `Checked in ${r?.name ?? "a guest"} (${action.count})`;
    }
    case "shiftRunsheet": {
      const item = findRecord(ev, "runsheet", action.fromId);
      const fn = functionsOf(ev).find((f) => f.id === action.fnId);
      const by = `${Math.abs(action.minutes)} min ${action.minutes > 0 ? "later" : "earlier"}`;
      return `Moved the ${fn?.label ?? "day"} run sheet ${by} from ${q(item?.title ?? "an item")}`;
    }
    case "setHeadcount":
      return `Planned for ${action.guests} guests${ev.layout === "personal" ? ` (was ${ev.guests})` : ""}`;
    case "bookVendor": {
      const v = findRecord(ev, "vendors", action.vendorId);
      return v ? `Booked ${v.name || "a vendor"} for ${v.category}` : "Booked a vendor";
    }
    case "editShifts": {
      const slot =
        ev.layout === "community" && action.slot !== undefined ? ev.shifts.slots[action.slot] : undefined;
      const where = `${action.role ?? ""}${slot ? `, ${slot}` : ""}`;
      if (action.op === "addVolunteer") return `Added ${action.name} to the volunteers`;
      if (action.op === "addRole") return `Added the volunteer role ${q(action.role ?? "")}`;
      if (action.op === "setNeed") return `Set ${where} to need ${action.need}`;
      return `Took ${action.name} off ${where}`;
    }
    case "updateEvent": {
      const p = action.patch;
      if (p.name) return `Renamed the event to ${q(p.name)}`;
      if (p.date) return `Moved the event to ${longDate(p.date)}`;
      if (p.site?.published === true) return "Published the event website";
      if (p.site?.published === false) return "Took the event website down";
      if (p.site) return "Updated the event website";
      return "Updated the event";
    }
  }
}

/** Default due dates for a booking: an advance in two weeks, the balance a week before. */
export function bookingSchedule(eventDate: string, today: string): { advance: string; balance: string } {
  const advance = addDays(today, 14);
  const balance = addDays(eventDate, -7);
  return { advance: advance < balance ? advance : today, balance: balance > today ? balance : eventDate };
}

export const shortDue = (iso: string) => dayMonth(iso);
