import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import type { PlannrEvent } from "../src/data/types";
import { slugId } from "../src/shared/eventLists";
import { linkExpiry, type PublicKind, type PublicView } from "../src/shared/public";
import { projectView } from "../src/shared/publicViews";
import { findRecord, list } from "../src/shared/records";
import { count } from "./admin";
import { events, type LinkKind, links } from "./db/schema";
import type { Db } from "./db/types";
import { HttpError, requireRole } from "./plans";

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
  requested = "",
): Promise<LinkRow> {
  await requireRole(db, eventId, userId, "planner");
  const ev = await plan(db, eventId);
  if (TARGETED.has(kind) && !requested) throw new HttpError(400, "Say who the link is for");
  const target = TARGETED.has(kind) ? requested : "";
  if (kind === "rsvp" && !findRecord(ev, "households", target))
    throw new HttpError(404, "Household not found");
  if (kind === "vendor" && !findRecord(ev, "vendors", target)) throw new HttpError(404, "Vendor not found");
  if (!projectView(ev, kind, target) && kind !== "site")
    throw new HttpError(400, "That page doesn't apply to this event");
  const existing = await findLink(db, eventId, kind, target);
  if (existing) return existing;
  const token = kind === "site" ? await freeSlug(db, ev.name) : randomBytes(12).toString("base64url");
  const [created] = await db
    .insert(links)
    .values({ token, eventId, kind, target, createdBy: userId })
    .onConflictDoNothing()
    .returning();
  if (created) return row(created);
  // Someone else made it at the same moment; use theirs.
  const again = await findLink(db, eventId, kind, target);
  if (!again) throw new HttpError(409, "Try again");
  return again;
}

async function findLink(
  db: Db,
  eventId: string,
  kind: LinkKind,
  target: string,
): Promise<LinkRow | undefined> {
  const [found] = await db
    .select()
    .from(links)
    .where(and(eq(links.eventId, eventId), eq(links.kind, kind), eq(links.target, target)));
  return found && row(found);
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

export interface Resolved {
  eventId: string;
  kind: PublicKind;
  target: string;
  event: PlannrEvent;
}

export async function resolve(db: Db, token: string): Promise<Resolved> {
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

/** What a shared link shows, counted as one open. */
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

/** Checks a stall request's fee against the event's own fee, so a request can't set its own price. */
export function stallFee(ev: PlannrEvent): number {
  const fees = list(ev, "stalls").map((s) => s.fee);
  return fees.length > 0 ? Math.max(...fees) : 0;
}

/** The link's event, for an upload that must be checked before it's stored. */
export async function albumEvent(db: Db, token: string): Promise<string> {
  const r = await resolve(db, token);
  if (r.kind !== "album") throw new HttpError(403, "Photos can only be added from the album link");
  return r.eventId;
}
