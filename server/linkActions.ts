import { randomUUID } from "node:crypto";
import type { Stall } from "../src/data/communityTypes";
import type { PlannrEvent } from "../src/data/types";
import type { EventAction } from "../src/shared/engine";
import { isHelper, type PublicKind, type PublicView } from "../src/shared/public";
import { findRecord } from "../src/shared/records";
import { count } from "./admin";
import type { Db } from "./db/types";
import { publicView, type Resolved, resolve, stallFee } from "./links";
import { isEventPhoto } from "./photos";
import { commit, HttpError } from "./plans";
import { parseAction } from "./validate";

/** Why a link may not make a change, or undefined when it may. */
type ScopeCheck = (r: Resolved, action: EventAction, ev: PlannrEvent) => string | undefined;
const NOT_ALLOWED = "Not allowed from this link";
/** Length limits for a name typed on the volunteer sign-up sheet. */
const VOLUNTEER_NAME = { min: 2, max: 40 };
/** A helper may tick their own tasks, and tick (only tick) their own checklist items. */
const helperScope: ScopeCheck = (r, action, ev) => {
  if (action.type === "toggleTask") {
    const t = ev.layout === "empty" ? undefined : ev.tasks.list.find((x) => x.id === action.taskId);
    return t && isHelper(t.who, r.target) ? undefined : "Only your own tasks";
  }
  if (action.type === "updateRecord" && action.coll === "checklist") {
    const c = findRecord(ev, "checklist", action.id);
    const keys = Object.keys(action.patch);
    const onlyDone = keys.length === 1 && keys[0] === "done";
    return c && isHelper(c.owner, r.target) && onlyDone ? undefined : "Only your own checklist";
  }
  return NOT_ALLOWED;
};
/** A volunteer may put their name on a slot that exists and still has room. */
const shiftsScope: ScopeCheck = (_, action, ev) => {
  if (action.type !== "assignShift" || ev.layout !== "community") return NOT_ALLOWED;
  const slot = ev.shifts.roles.find((x) => x.role === action.role)?.slots[action.slot];
  if (!slot) return "That shift doesn't exist";
  if (slot.names.length >= slot.need) return "That shift is already full";
  const name = action.name.trim();
  if (name.length < VOLUNTEER_NAME.min || name.length > VOLUNTEER_NAME.max) return "Add your name";
  return undefined;
};
/** A guest may add photos, but only ones uploaded to this event's own store. */
const albumScope: ScopeCheck = (r, action) => {
  if (action.type !== "addRecord" || action.coll !== "album") return NOT_ALLOWED;
  const url = (action.record as { url?: string }).url ?? "";
  return isEventPhoto(url, r.eventId) ? undefined : "Photos must be uploaded through Plannr";
};
/** A stallholder may ask for a stall: unconfirmed and unpaid. */
const stallsScope: ScopeCheck = (_, action) => {
  if (action.type !== "addRecord" || action.coll !== "stalls") return NOT_ALLOWED;
  const s = action.record as { status?: string; paid?: boolean };
  return s.status === "requested" && s.paid === false ? undefined : NOT_ALLOWED;
};
/** The changes each kind of link may make, checked against the plan as it is now. Others are read-only. */
const SCOPES: Partial<Record<PublicKind, ScopeCheck>> = {
  rsvp: (r, action) =>
    action.type === "rsvp" && action.householdId === r.target ? undefined : "Only your own RSVP",
  helper: helperScope,
  shifts: shiftsScope,
  album: albumScope,
  stalls: stallsScope,
  gate: (_, action) => (action.type === "checkIn" && action.coll === "passes" ? undefined : NOT_ALLOWED),
};
function scope(r: Resolved, action: EventAction, ev: PlannrEvent): string | undefined {
  const check = SCOPES[r.kind];
  return check ? check(r, action, ev) : "This page is read-only";
}
/** A field of a record a link is adding, if it's a string. */
function recordField(action: EventAction, field: "by" | "owner"): string | undefined {
  if (action.type !== "addRecord") return undefined;
  const value: unknown = Reflect.get(action.record, field);
  return typeof value === "string" ? value : undefined;
}
/** How history names whoever used the link. */
const ACTORS: Partial<Record<PublicKind, (r: Resolved, action: EventAction) => string>> = {
  rsvp: (r) => `${findRecord(r.event, "households", r.target)?.name ?? "A guest"} (RSVP)`,
  helper: (r) => `${r.target} (helper link)`,
  shifts: (_, action) => `${action.type === "assignShift" ? action.name.trim() : "A volunteer"} (sign-up)`,
  album: (_, action) => `${recordField(action, "by") ?? "A guest"} (album)`,
  stalls: (_, action) => `${recordField(action, "owner") ?? "A stallholder"} (stall request)`,
  gate: () => "Gate volunteer",
};
function actorFor(r: Resolved, action: EventAction): string {
  return ACTORS[r.kind]?.(r, action) ?? "Shared link";
}
/** Fills in what a link decides for itself, whatever the browser sent. */
function fromLink(r: Resolved, action: EventAction): EventAction {
  // An RSVP link always answers for its own household.
  if (action.type === "rsvp" && r.kind === "rsvp") return { ...action, householdId: r.target };
  if (action.type !== "addRecord") return action;
  // Records made from a link get their id here, never from the browser.
  const record = { ...action.record, id: newId(action.coll) };
  if (action.coll !== "stalls") return { ...action, record };
  // A stall request pays the event's own fee and starts unconfirmed.
  return {
    ...action,
    record: { ...(record as Stall), fee: stallFee(r.event), status: "requested", paid: false },
  };
}
/** Most changes one request from a shared link may carry. */
const MAX_LINK_ACTIONS = 5;

/**
 * Applies changes sent from a shared link. Each is checked twice: its shape, and that this
 * link may make it, again against the latest plan if someone else wrote in between.
 */
export async function publicActions(db: Db, token: string, raw: unknown[]): Promise<PublicView> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINK_ACTIONS)
    throw new HttpError(400, "Send one to five changes");
  const r = await resolve(db, token);
  const actions = raw.map((item) => {
    const parsed = parseAction(item);
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    return fromLink(r, parsed.action);
  });
  const first = actions[0];
  if (!first) throw new HttpError(400, "Nothing to change");
  if (first.type === "rsvp") await count(db, "rsvp");
  if (first.type === "addRecord" && first.coll === "album") await count(db, "photo");
  await commit(db, r.eventId, { actor: actorFor(r, first) }, actions, (current, action) => {
    const problem = scope(r, action, current);
    if (problem) throw new HttpError(403, problem);
  });
  return publicView(db, token);
}
/** A server-made id for a record added from a link: "al_1a2b3c4d-5e6". */
function newId(coll: string): string {
  return `${coll.slice(0, 2)}_${randomUUID().slice(0, 12)}`;
}
