import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import type { PlannrEvent, Stall } from "../src/data/types";
import type { EventAction } from "../src/shared/engine";
import { isHelper, linkExpiry, type PublicKind, type PublicView, projectView } from "../src/shared/public";
import { findRecord, list, slugId } from "../src/shared/records";
import { count } from "./admin";
import { events, type LinkKind, links } from "./db/schema";
import type { Db } from "./db/types";
import { isEventPhoto } from "./photos";
import { commit, HttpError, requireRole } from "./plans";
import { parseAction } from "./validate";

/**
 * Shared links: pages people open without an account. A link names one event, one kind of
 * page and, for most kinds, one target (a household, a helper, a vendor). The token in the
 * URL is the only key, so it is long and random, except the event website's readable slug.
 */

const KINDS: LinkKind[] = ["rsvp", "helper", "vendor", "shifts", "fund", "site", "album", "stalls", "gate"];
/** Kinds that are about one record; the rest are about the whole event. */
const TARGETED = new Set<LinkKind>(["rsvp", "helper", "vendor"]);

export function isLinkKind(k: unknown): k is LinkKind {
  return typeof k === "string" && (KINDS as string[]).includes(k);
}

export interface LinkRow {
  token: string;
  kind: LinkKind;
  target: string;
  createdAt: string;
  lastUsedAt: string | null;
}

async function plan(db: Db, eventId: string): Promise<PlannrEvent> {
  const [row] = await db.select({ data: events.data }).from(events).where(eq(events.id, eventId));
  if (!row) throw new HttpError(404, "Event not found");
  return row.data;
}

/** A readable, unused slug for the event website: "ananya-rohans-wedding", then "-2", "-3". */
async function freeSlug(db: Db, name: string): Promise<string> {
  const root = slugId(name).slice(0, 40) || "event";
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const [taken] = await db.select({ token: links.token }).from(links).where(eq(links.token, candidate));
    if (!taken) return candidate;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

/** The link for a kind and target, made the first time it's asked for. Planners only. */
export async function linkFor(
  db: Db,
  eventId: string,
  userId: string,
  kind: LinkKind,
  target = "",
): Promise<LinkRow> {
  await requireRole(db, eventId, userId, "planner");
  const ev = await plan(db, eventId);
  if (TARGETED.has(kind) && !target) throw new HttpError(400, "Say who the link is for");
  if (!TARGETED.has(kind)) target = "";
  if (kind === "rsvp" && !findRecord(ev, "households", target))
    throw new HttpError(404, "Household not found");
  if (kind === "vendor" && !findRecord(ev, "vendors", target)) throw new HttpError(404, "Vendor not found");
  if (!projectView(ev, kind, target) && kind !== "site")
    throw new HttpError(400, "That page doesn't apply to this event");
  const [existing] = await db
    .select()
    .from(links)
    .where(and(eq(links.eventId, eventId), eq(links.kind, kind), eq(links.target, target)));
  if (existing) return row(existing);
  const token = kind === "site" ? await freeSlug(db, ev.name) : randomBytes(12).toString("base64url");
  const [created] = await db
    .insert(links)
    .values({ token, eventId, kind, target, createdBy: userId })
    .onConflictDoNothing()
    .returning();
  if (created) return row(created);
  // Someone else made it at the same moment; use theirs.
  const [again] = await db
    .select()
    .from(links)
    .where(and(eq(links.eventId, eventId), eq(links.kind, kind), eq(links.target, target)));
  if (!again) throw new HttpError(409, "Try again");
  return row(again);
}

function row(r: typeof links.$inferSelect): LinkRow {
  return {
    token: r.token,
    kind: r.kind,
    target: r.target,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  };
}

export async function listLinks(db: Db, eventId: string, userId: string): Promise<LinkRow[]> {
  await requireRole(db, eventId, userId, "viewer");
  const rows = await db.select().from(links).where(eq(links.eventId, eventId));
  return rows.map(row);
}

/** Stops a link working. A new one can be made; the old URL never works again. */
export async function revokeLink(db: Db, eventId: string, userId: string, token: string): Promise<void> {
  await requireRole(db, eventId, userId, "planner");
  await db.delete(links).where(and(eq(links.eventId, eventId), eq(links.token, token)));
}

/** Renames the event website's address. */
export async function renameSite(db: Db, eventId: string, userId: string, slug: string): Promise<LinkRow> {
  await requireRole(db, eventId, userId, "planner");
  const clean = slugId(slug).slice(0, 48);
  if (clean.length < 3) throw new HttpError(400, "Use at least 3 letters or numbers");
  const [taken] = await db
    .select({ token: links.token })
    .from(links)
    .where(and(eq(links.token, clean), ne(links.eventId, eventId)));
  if (taken) throw new HttpError(409, "That address is taken. Try adding a year or a place.");
  await db.delete(links).where(and(eq(links.eventId, eventId), eq(links.kind, "site")));
  const [created] = await db
    .insert(links)
    .values({ token: clean, eventId, kind: "site", target: "", createdBy: userId })
    .returning();
  if (!created) throw new HttpError(409, "Try again");
  return row(created);
}

interface Resolved {
  eventId: string;
  kind: PublicKind;
  target: string;
  event: PlannrEvent;
}

async function resolve(db: Db, token: string): Promise<Resolved> {
  if (!/^[\w-]{3,64}$/.test(token)) throw new HttpError(404, "This link isn't valid");
  const [link] = await db.select().from(links).where(eq(links.token, token));
  if (!link) throw new HttpError(404, "This link isn't valid. Ask the family for a new one.");
  const event = await plan(db, link.eventId);
  if (event.archived) throw new HttpError(410, "This event has been archived");
  if (linkExpiry(event, link.kind) < new Date().toISOString().slice(0, 10))
    throw new HttpError(410, "This link has expired. Ask the family for a new one if you still need it.");
  // Mark it used, at most once an hour, so hosts can see which links were opened.
  if (!link.lastUsedAt || Date.now() - link.lastUsedAt.getTime() > 3_600_000)
    await db.update(links).set({ lastUsedAt: new Date() }).where(eq(links.token, token));
  return { eventId: link.eventId, kind: link.kind, target: link.target, event };
}

export async function publicView(db: Db, token: string): Promise<PublicView> {
  const r = await resolve(db, token);
  await count(db, "link_open");
  const view = projectView(r.event, r.kind, r.target);
  if (!view)
    throw new HttpError(
      404,
      r.kind === "site" ? "This event's website isn't published yet." : "This page is no longer available.",
    );
  return view;
}

/** The changes each kind of link may make, checked against the plan as it is now. */
function scope(r: Resolved, action: EventAction, ev: PlannrEvent): string | undefined {
  switch (r.kind) {
    case "rsvp":
      return action.type === "rsvp" && action.householdId === r.target ? undefined : "Only your own RSVP";
    case "helper": {
      if (action.type === "toggleTask") {
        const t = ev.layout === "empty" ? undefined : ev.tasks.list.find((x) => x.id === action.taskId);
        return t && isHelper(t.who, r.target) ? undefined : "Only your own tasks";
      }
      if (action.type === "updateRecord" && action.coll === "checklist") {
        const c = findRecord(ev, "checklist", action.id);
        const keys = Object.keys(action.patch);
        return c && isHelper(c.owner, r.target) && keys.length === 1 && keys[0] === "done"
          ? undefined
          : "Only your own checklist";
      }
      return "Not allowed from this link";
    }
    case "shifts": {
      if (action.type !== "assignShift" || ev.layout !== "community") return "Not allowed from this link";
      const slot = ev.shifts.roles.find((x) => x.role === action.role)?.slots[action.slot];
      if (!slot) return "That shift doesn't exist";
      if (slot.names.length >= slot.need) return "That shift is already full";
      const name = action.name.trim();
      if (name.length < 2 || name.length > 40) return "Add your name";
      return undefined;
    }
    case "album": {
      if (action.type !== "addRecord" || action.coll !== "album") return "Not allowed from this link";
      const url = (action.record as { url?: string }).url ?? "";
      return isEventPhoto(url, r.eventId) ? undefined : "Photos must be uploaded through Plannr";
    }
    case "stalls": {
      if (action.type !== "addRecord" || action.coll !== "stalls") return "Not allowed from this link";
      const s = action.record as { status?: string; paid?: boolean };
      return s.status === "requested" && s.paid === false ? undefined : "Not allowed from this link";
    }
    case "gate":
      return action.type === "checkIn" && action.coll === "passes" ? undefined : "Not allowed from this link";
    default:
      return "This page is read-only";
  }
}

function actorFor(r: Resolved, action: EventAction): string {
  switch (r.kind) {
    case "rsvp":
      return `${findRecord(r.event, "households", r.target)?.name ?? "A guest"} (RSVP)`;
    case "helper":
      return `${r.target} (helper link)`;
    case "shifts":
      return `${action.type === "assignShift" ? action.name.trim() : "A volunteer"} (sign-up)`;
    case "album":
      return `${action.type === "addRecord" && "by" in action.record ? action.record.by : "A guest"} (album)`;
    case "stalls":
      return `${action.type === "addRecord" && "owner" in action.record ? action.record.owner : "A stallholder"} (stall request)`;
    case "gate":
      return "Gate volunteer";
    default:
      return "Shared link";
  }
}

/**
 * Applies changes sent from a shared link. Each is checked twice: its shape, and that this
 * link may make it, again against the latest plan if someone else wrote in between.
 */
export async function publicActions(db: Db, token: string, raw: unknown[]): Promise<PublicView> {
  if (!Array.isArray(raw) || !raw.length || raw.length > 5)
    throw new HttpError(400, "Send one to five changes");
  const r = await resolve(db, token);
  const actions: EventAction[] = [];
  for (const item of raw) {
    const parsed = parseAction(item);
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    let action = parsed.action;
    // An RSVP link always answers for its own household.
    if (action.type === "rsvp" && r.kind === "rsvp") action = { ...action, householdId: r.target };
    // Records made from a link get their id here, never from the browser.
    if (action.type === "addRecord")
      action = { ...action, record: { ...action.record, id: newId(action.coll) } };
    // A stall request pays the event's own fee and starts unconfirmed, whatever was sent.
    if (action.type === "addRecord" && action.coll === "stalls")
      action = {
        ...action,
        record: { ...(action.record as Stall), fee: stallFee(r.event), status: "requested", paid: false },
      };
    actions.push(action);
  }
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

function newId(coll: string): string {
  return `${coll.slice(0, 2)}_${randomUUID().slice(0, 12)}`;
}

/** Checks a stall request's fee against the event's own fee, so a request can't set its own price. */
export function stallFee(ev: PlannrEvent): number {
  const fees = list(ev, "stalls").map((s) => s.fee);
  return fees.length ? Math.max(...fees) : 0;
}

/** The link's event, for an upload that must be checked before it's stored. */
export async function albumEvent(db: Db, token: string): Promise<string> {
  const r = await resolve(db, token);
  if (r.kind !== "album") throw new HttpError(403, "Photos can only be added from the album link");
  return r.eventId;
}
