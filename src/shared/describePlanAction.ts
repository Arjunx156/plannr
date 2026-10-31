import type { Household, RsvpStatus } from "../data/guestTypes";
import type { PlannrEvent } from "../data/types";
import { longDate } from "../lib/dates";
import { inr } from "../lib/format";
import { functionsOf } from "./eventLists";
import type { ActionOf, ByAction, PlanAction } from "./planActions";
import { type Coll, findRecord, recordName } from "./records";

// ---------------------------------------------------------------- history lines
const q = (s: string) => `“${s}”`;
/** "Added the household “Menon family” (4)", "Announced “Buses leave at 8”", … */
function describeAddRecord(ev: PlannrEvent, { coll, record: r }: ActionOf<"addRecord">): string {
  if (coll === "memory" && "text" in r) return `Plannr will remember ${q(r.text)}`;
  if (coll === "announcements" && "text" in r) return `Announced ${q(r.text)}`;
  if (coll === "households") {
    const h = r as Household;
    return `Added the household ${q(h.name)} (${h.expected})`;
  }
  if (coll === "payments" && "amount" in r && "label" in r)
    return `Scheduled ${inr(r.amount)}: ${q(r.label)}`;
  return `${findRecord(ev, coll, r.id) ? "Updated" : "Added"} ${recordName(coll, r)}`;
}
/** The line for a change to the one field that matters most in its collection, if that's what changed. */
function describeKeyField(coll: Coll, name: string, changes: Record<string, unknown>): string | undefined {
  const { stage, date, planned, status } = changes;
  if (coll === "vendors" && typeof stage === "string") return `Moved ${name} to ${stage}`;
  if (coll === "functions" && typeof date === "string") return `Moved ${name} to ${longDate(date)}`;
  if (coll === "categories" && typeof planned === "number") return `Set ${name} to ${inr(planned)}`;
  if (coll === "approvals" && typeof status === "string")
    return `${status === "approved" ? "Approved" : "Declined"} ${name}`;
  return undefined;
}
/** Names the change for the fields that matter most, else just the record. */
function describeUpdateRecord(
  ev: PlannrEvent,
  { coll, id, patch: changes }: ActionOf<"updateRecord">,
): string {
  const name = recordName(coll, findRecord(ev, coll, id));
  const keyField = describeKeyField(coll, name, changes);
  if (keyField) return keyField;
  const toggles = ("done" in changes || "thanked" in changes) && Object.keys(changes).length === 1;
  if (toggles) return `${changes.done || changes.thanked ? "Ticked off" : "Reopened"} ${name}`;
  return `Updated ${name}`;
}
/** "Menon family replied: 4 coming to Haldi, Wedding, not Reception" */
function describeRsvp(ev: PlannrEvent, action: ActionOf<"rsvp">): string {
  const h = findRecord(ev, "households", action.householdId);
  const fns = functionsOf(ev);
  const answers = Object.entries(action.answers);
  const labels = (status: RsvpStatus) =>
    answers.filter(([, a]) => a.status === status).map(([id]) => fns.find((f) => f.id === id)?.label ?? id);
  const going = labels("yes");
  const notGoing = labels("no");
  const who = h?.name ?? "A household";
  if (going.length === 0) {
    const someStill = h && notGoing.length < h.functions.length;
    return someStill ? `${who} can't come to ${notGoing.join(", ")}` : `${who} can't come`;
  }
  const people = Math.max(0, ...answers.map(([, a]) => (a.status === "yes" ? a.count : 0)));
  const not = notGoing.length > 0 ? `, not ${notGoing.join(", ")}` : "";
  return `${who} replied: ${people} coming to ${going.join(", ")}${not}`;
}
/** "Set Parking, Saturday morning to need 4", "Took Anu off Stage, Sunday" */
function describeEditShifts(ev: PlannrEvent, action: ActionOf<"editShifts">): string {
  if (action.op === "addVolunteer") return `Added ${action.name} to the volunteers`;
  if (action.op === "addRole") return `Added the volunteer role ${q(action.role ?? "")}`;
  const slot =
    ev.layout === "community" && action.slot !== undefined ? ev.shifts.slots[action.slot] : undefined;
  const where = `${action.role ?? ""}${slot ? `, ${slot}` : ""}`;
  if (action.op === "setNeed") return `Set ${where} to need ${action.need}`;
  return `Took ${action.name} off ${where}`;
}
/** Names the first detail that changed. */
function describeUpdateEvent({ patch: p }: ActionOf<"updateEvent">): string {
  if (p.name) return `Renamed the event to ${q(p.name)}`;
  if (p.date) return `Moved the event to ${longDate(p.date)}`;
  if (p.site?.published === true) return "Published the event website";
  if (p.site?.published === false) return "Took the event website down";
  if (p.site) return "Updated the event website";
  return "Updated the event";
}
const DESCRIPTIONS: ByAction<string> = {
  addRecord: describeAddRecord,
  updateRecord: describeUpdateRecord,
  removeRecord: (ev, a) => `Removed ${recordName(a.coll, findRecord(ev, a.coll, a.id))}`,
  rsvp: describeRsvp,
  markPaid: (ev, a) => {
    const p = findRecord(ev, "payments", a.paymentId);
    if (!p) return "Changed a payment";
    return a.paid ? `Paid ${inr(p.amount)}: ${q(p.label)}` : `Marked ${q(p.label)} as not paid`;
  },
  checkIn: (ev, a) => `Checked in ${findRecord(ev, a.coll, a.id)?.name ?? "a guest"} (${a.count})`,
  shiftRunsheet: (ev, a) => {
    const item = findRecord(ev, "runsheet", a.fromId);
    const fn = functionsOf(ev).find((f) => f.id === a.fnId);
    const by = `${Math.abs(a.minutes)} min ${a.minutes > 0 ? "later" : "earlier"}`;
    return `Moved the ${fn?.label ?? "day"} run sheet ${by} from ${q(item?.title ?? "an item")}`;
  },
  setHeadcount: (ev, a) =>
    `Planned for ${a.guests} guests${ev.layout === "personal" ? ` (was ${ev.guests})` : ""}`,
  bookVendor: (ev, a) => {
    const v = findRecord(ev, "vendors", a.vendorId);
    return v ? `Booked ${v.name || "a vendor"} for ${v.category}` : "Booked a vendor";
  },
  editShifts: describeEditShifts,
  updateEvent: (_, a) => describeUpdateEvent(a),
};

/** A history line for a plan change, worded from the plan as it was before the change. */
export function describePlanAction(action: PlanAction, ev: PlannrEvent): string {
  const describe = DESCRIPTIONS[action.type] as (ev: PlannrEvent, action: PlanAction) => string;
  return describe(ev, action);
}
