import type { PayMethod } from "../data/budgetTypes";
import type { Slot } from "../data/communityTypes";
import type { Meal, RsvpStatus } from "../data/guestTypes";
import type { RunItem, SiteInfo } from "../data/recordTypes";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../data/types";
import { addDays, dayMonth } from "../lib/dates";
import { eventName } from "./eventEdits";
import { type AnyRecord, type Coll, findRecord, list, patch, remove, setList, upsert } from "./records";

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

export type ActionOf<T extends PlanAction["type"]> = Extract<PlanAction, { type: T }>;

/** One entry per action type: the mapped type makes the compiler insist on every one. */
export type ByAction<R> = { [T in PlanAction["type"]]: (ev: PlannrEvent, action: ActionOf<T>) => R };

// ---------------------------------------------------------------- reducers

/** Most guests one invited household can bring beyond the number invited. */
const EXTRA_GUESTS = 2;
/** Most volunteers one shift can ask for. */
const MAX_SHIFT_NEED = 99;
/** Volunteers a newly added role asks for in each slot. */
const NEW_ROLE_NEED = 2;

/** Only functions the household is invited to, and never more people than invited plus two. */
function applyRsvp(ev: PlannrEvent, action: ActionOf<"rsvp">): PlannrEvent {
  const h = findRecord(ev, "households", action.householdId);
  if (!h) return ev;
  const answers: typeof h.rsvp = { ...h.rsvp };
  for (const [fnId, a] of Object.entries(action.answers)) {
    if (!h.functions.includes(fnId)) continue;
    const count = a.status === "yes" ? Math.max(1, Math.min(a.count, h.expected + EXTRA_GUESTS)) : 0;
    answers[fnId] = { status: a.status, count };
  }
  return patch(ev, "households", h.id, {
    rsvp: answers,
    meal: action.meal ?? h.meal,
    stay: action.stay ?? h.stay,
    pickup: action.pickup ?? h.pickup,
    note: action.note ?? h.note,
    respondedAt: action.at ?? h.respondedAt,
  });
}

/** Adds `amount` (negative to take it back) to what one side of the family has paid. */
function creditSide(ev: PersonalEvent, side: string, amount: number): PersonalEvent {
  const split = ev.budget.split;
  if (!split) return ev;
  const sides = split.sides.map((s) => (s.name === side ? { ...s, paid: Math.max(0, s.paid + amount) } : s));
  return { ...ev, budget: { ...ev.budget, split: { ...split, sides } } };
}

/** Marks a payment paid or unpaid, moving its amount into or out of its category and payer's share. */
function applyMarkPaid(ev: PlannrEvent, action: ActionOf<"markPaid">): PlannrEvent {
  if (ev.layout !== "personal") return ev;
  const p = findRecord(ev, "payments", action.paymentId);
  if (!p || p.paid === action.paid) return ev;
  const amount = action.paid ? p.amount : -p.amount;
  const by = action.paid ? (action.by ?? p.by) : p.by;
  let next = patch(ev, "payments", p.id, {
    paid: action.paid,
    paidOn: action.paid ? action.on : undefined,
    method: action.paid ? action.method : undefined,
    by,
  });
  const category = p.categoryId ? findRecord(next, "categories", p.categoryId) : undefined;
  if (category)
    next = patch(next, "categories", category.id, { spent: Math.max(0, category.spent + amount) });
  return by ? creditSide(next, by, amount) : next;
}

/** Sets how many people from a household or pass have arrived at one function. */
function applyCheckIn(ev: PlannrEvent, action: ActionOf<"checkIn">): PlannrEvent {
  const count = Math.max(0, Math.round(action.count));
  if (action.coll === "passes") return patch(ev, "passes", action.id, { checkedIn: count });
  const h = findRecord(ev, "households", action.id);
  return h ? patch(ev, "households", h.id, { checkedIn: { ...h.checkedIn, [action.fnId]: count } }) : ev;
}

/** Moves one item of a function's run sheet, and everything not done after it, by some minutes. */
function applyShiftRunsheet(ev: PlannrEvent, action: ActionOf<"shiftRunsheet">): PlannrEvent {
  const items = list(ev, "runsheet");
  const from = items.find((i) => i.id === action.fromId);
  if (!from || !action.minutes) return ev;
  const moves = (i: RunItem) => i.fnId === action.fnId && i.time >= from.time && !i.done;
  return setList(
    ev,
    "runsheet",
    items.map((i) => (moves(i) ? { ...i, time: addMinutes(i.time, action.minutes) } : i)),
  );
}

/** Adds a volunteer role, once (names compared without case), with the default need in every slot. */
function addRole(ev: CommunityEvent, role: string): CommunityEvent {
  const { shifts } = ev;
  if (!role || shifts.roles.some((r) => r.role.toLowerCase() === role.toLowerCase())) return ev;
  const slots = shifts.slots.map(() => ({ need: NEW_ROLE_NEED, names: [] }));
  return { ...ev, shifts: { ...shifts, roles: [...shifts.roles, { role, slots }] } };
}

/** Changes one slot of one role: how many it needs, or who comes off it. */
function editSlot(ev: CommunityEvent, action: ActionOf<"editShifts">): CommunityEvent {
  const { op, role = "", slot = -1, name = "" } = action;
  const edit = (s: Slot): Slot =>
    op === "setNeed"
      ? { ...s, need: Math.max(0, Math.min(MAX_SHIFT_NEED, Math.round(action.need ?? s.need))) }
      : { ...s, names: s.names.filter((n) => n !== name) };
  const roles = ev.shifts.roles.map((r) =>
    r.role === role ? { ...r, slots: r.slots.map((s, i) => (i === slot ? edit(s) : s)) } : r,
  );
  return { ...ev, shifts: { ...ev.shifts, roles } };
}

/** Edits the mela's volunteer rota. */
function applyEditShifts(ev: PlannrEvent, action: ActionOf<"editShifts">): PlannrEvent {
  if (ev.layout !== "community") return ev;
  const { op, name = "" } = action;
  if (op === "addVolunteer")
    return name && !ev.volunteers.includes(name) ? { ...ev, volunteers: [...ev.volunteers, name] } : ev;
  if (op === "addRole") return addRole(ev, action.role ?? "");
  return editSlot(ev, action);
}

/** Changes the event's own details: name, date, list line and website. */
function applyUpdateEvent(ev: PlannrEvent, { patch: p }: ActionOf<"updateEvent">): PlannrEvent {
  return {
    ...ev,
    name: eventName(p.name, ev.name),
    ...(p.date ? { date: p.date } : {}),
    ...(p.listMeta ? { listMeta: p.listMeta } : {}),
    ...(p.site && ev.layout !== "empty" ? { site: { ...ev.site, ...p.site } } : {}),
  } as PlannrEvent;
}

const REDUCERS: ByAction<PlannrEvent> = {
  addRecord: (ev, a) => upsert(ev, a.coll, a.record),
  updateRecord: (ev, a) => patch(ev, a.coll, a.id, a.patch as Partial<AnyRecord>),
  removeRecord: (ev, a) => remove(ev, a.coll, a.id),
  rsvp: applyRsvp,
  markPaid: applyMarkPaid,
  checkIn: applyCheckIn,
  shiftRunsheet: applyShiftRunsheet,
  setHeadcount: (ev, a) =>
    ev.layout === "personal" ? { ...ev, guests: Math.max(1, Math.round(a.guests)) } : ev,
  bookVendor: (ev, a) => {
    const v = findRecord(ev, "vendors", a.vendorId);
    return v ? patch(ev, "vendors", v.id, { stage: "booked", chosenQuote: a.quoteId ?? v.chosenQuote }) : ev;
  },
  editShifts: applyEditShifts,
  updateEvent: applyUpdateEvent,
};

/** Applies one record change. An event with no plan yet only takes changes to its own details. */
export function applyPlanAction(ev: PlannrEvent, action: PlanAction): PlannrEvent {
  if (ev.layout === "empty" && action.type !== "updateEvent") return ev;
  // TypeScript can't correlate the table's key with its handler's argument; the table's type does.
  const reduce = REDUCERS[action.type] as (ev: PlannrEvent, action: PlanAction) => PlannrEvent;
  return reduce(ev, action);
}

/** Default due dates for a booking: an advance in two weeks, the balance a week before. */
export function bookingSchedule(eventDate: string, today: string): { advance: string; balance: string } {
  const advance = addDays(today, 14);
  const balance = addDays(eventDate, -7);
  return { advance: advance < balance ? advance : today, balance: balance > today ? balance : eventDate };
}

/** A due date as "12 Oct". */
export const shortDue = (iso: string) => dayMonth(iso);
