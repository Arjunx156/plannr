import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { PlannrEvent } from "../src/data/types";
import { slugId } from "../src/shared/eventLists";
import { fromTemplate, toTemplate } from "../src/shared/templates";
import type { PlanSummary, TemplateRow } from "../src/shared/types";
import { events, templates } from "./db/schema";
import type { Db } from "./db/types";
import { createPlan, HttpError, requireRole } from "./plans";

export async function saveTemplate(
  db: Db,
  userId: string,
  eventId: string,
  name: string,
): Promise<TemplateRow> {
  await requireRole(db, eventId, userId, "planner");
  const [row] = await db.select({ data: events.data }).from(events).where(eq(events.id, eventId));
  if (!row) throw new HttpError(404, "Event not found");
  if (row.data.layout === "empty") throw new HttpError(400, "Plan the event before saving it as a template");
  const id = `tpl_${randomUUID().slice(0, 12)}`;
  const data = toTemplate(row.data);
  await db
    .insert(templates)
    .values({ id, ownerId: userId, name: name.trim().slice(0, 120), kind: data.kind, data });
  return { id, name, kind: data.kind, createdAt: new Date().toISOString(), date: data.date };
}

export async function listTemplates(db: Db, userId: string): Promise<TemplateRow[]> {
  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      kind: templates.kind,
      createdAt: templates.createdAt,
      data: templates.data,
    })
    .from(templates)
    .where(eq(templates.ownerId, userId))
    .orderBy(desc(templates.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    createdAt: r.createdAt.toISOString(),
    date: r.data.date,
  }));
}

export async function deleteTemplate(db: Db, userId: string, id: string): Promise<void> {
  await db.delete(templates).where(and(eq(templates.id, id), eq(templates.ownerId, userId)));
}

/** A new plan from a template, owned by the person using it. */
export async function planFromTemplate(
  db: Db,
  userId: string,
  id: string,
  opts: { name: string; date: string },
): Promise<PlanSummary> {
  const [row] = await db
    .select({ data: templates.data })
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.ownerId, userId)));
  if (!row) throw new HttpError(404, "Template not found");
  const eventId = `${slugId(opts.name).slice(0, 40)}-${randomUUID().slice(0, 8)}`;
  const event: PlannrEvent = fromTemplate(row.data, {
    id: eventId,
    name: opts.name.trim().slice(0, 120),
    date: opts.date,
  });
  return createPlan(db, userId, event);
}
