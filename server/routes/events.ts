import { z } from "zod";
import type { PlannrEvent } from "../../src/data/types";
import { EVENT_ACTION_TYPES, type EventAction } from "../../src/shared/engine";
import { isLinkKind, linkFor, listLinks, renameSite, revokeLink } from "../links";
import {
  acceptInvite,
  addComment,
  applyActions,
  createInvite,
  createPlan,
  getPlan,
  HttpError,
  history,
  listComments,
  listMembers,
  listPlans,
  planVersion,
  removeMember,
  requireRole,
  undoChange,
  updateMember,
} from "../plans";
import { deleteTemplate, listTemplates, planFromTemplate, saveTemplate } from "../templates";
import { parseAction } from "../validate";
import { type Api, body, type RouteDeps } from "./kit";

const MAX_EVENT_BYTES = 400 * 1024;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The outline every plan must have; the rest is checked change by change. */
const eventShape = z
  .object({
    id: z.string().min(3).max(120),
    kind: z.enum(["wedding", "birthday", "community", "other"]),
    layout: z.enum(["personal", "community", "empty"]),
    name: z.string().min(1).max(200),
    date: z.string().regex(ISO_DATE),
  })
  .passthrough();

const actionShape = z
  .object({
    type: z.string().refine((t) => EVENT_ACTION_TYPES.has(t as EventAction["type"]), "Unknown change"),
    // Only a new draft carries a whole plan; it gets the same checks as creating one.
    event: eventShape.optional(),
  })
  .passthrough()
  .refine((a) => a.type !== "replacePlan" || !!a.event, "A new draft needs its plan");

const roleShape = z.enum(["planner", "viewer"]);

/** Plans and everything inside one: changes, history, people, invites, links, templates and comments. */
export function eventRoutes(app: Api, { db, store }: RouteDeps): void {
  // ------------------------------------------------------------ plans
  app.get("/events", async (c) => c.json({ plans: await listPlans(db, c.get("userId")) }));
  app.post("/events", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_EVENT_BYTES)
      throw new HttpError(413, "That plan is too large");
    const { event } = await body(c, z.object({ event: eventShape }));
    return c.json(await createPlan(db, c.get("userId"), event as unknown as PlannrEvent), 201);
  });
  app.get("/events/:id", async (c) => c.json(await getPlan(db, c.req.param("id"), c.get("userId"))));
  app.post("/events/:id/photo", async (c) => {
    await requireRole(db, c.req.param("id"), c.get("userId"), "planner");
    return c.json({ url: await store(c.req.param("id"), c.req.raw) }, 201);
  });
  app.get("/events/:id/version", async (c) =>
    c.json({ version: await planVersion(db, c.req.param("id"), c.get("userId")) }),
  );
  app.post("/events/:id/actions", async (c) => {
    const { actions } = await body(c, z.object({ actions: z.array(actionShape).min(1).max(50) }));
    const parsed = actions.map((a) => parseAction(a));
    const bad = parsed.find((p) => !p.ok);
    if (bad && !bad.ok) throw new HttpError(400, bad.error);
    return c.json(
      await applyActions(
        db,
        c.req.param("id"),
        c.get("userId"),
        parsed.flatMap((p) => (p.ok ? [p.action] : [])),
      ),
    );
  });

  // ------------------------------------------------------------ templates
  app.get("/templates", async (c) => c.json({ templates: await listTemplates(db, c.get("userId")) }));
  app.post("/events/:id/template", async (c) => {
    const { name } = await body(c, z.object({ name: z.string().trim().min(1).max(120) }));
    return c.json(await saveTemplate(db, c.get("userId"), c.req.param("id"), name), 201);
  });
  app.post("/templates/:id/use", async (c) => {
    const { name, date } = await body(
      c,
      z.object({ name: z.string().trim().min(1).max(120), date: z.string().regex(ISO_DATE) }),
    );
    return c.json(await planFromTemplate(db, c.get("userId"), c.req.param("id"), { name, date }), 201);
  });
  app.delete("/templates/:id", async (c) => {
    await deleteTemplate(db, c.get("userId"), c.req.param("id"));
    return c.json({ ok: true });
  });

  // ------------------------------------------------------------ shared links
  app.get("/events/:id/links", async (c) =>
    c.json({ links: await listLinks(db, c.req.param("id"), c.get("userId")) }),
  );
  app.post("/events/:id/links", async (c) => {
    const { kind, target } = await body(
      c,
      z.object({ kind: z.string(), target: z.string().max(120).optional() }),
    );
    if (!isLinkKind(kind)) throw new HttpError(400, "Unknown kind of link");
    return c.json(await linkFor(db, c.req.param("id"), c.get("userId"), kind, target ?? ""), 201);
  });
  app.delete("/events/:id/links/:token", async (c) => {
    await revokeLink(db, c.req.param("id"), c.get("userId"), c.req.param("token"));
    return c.json({ ok: true });
  });
  app.put("/events/:id/site-address", async (c) => {
    const { slug } = await body(c, z.object({ slug: z.string().max(60) }));
    return c.json(await renameSite(db, c.req.param("id"), c.get("userId"), slug));
  });

  // ------------------------------------------------------------ history
  app.get("/events/:id/history", async (c) =>
    c.json({
      history: await history(db, c.req.param("id"), c.get("userId"), Number(c.req.query("limit") ?? 100)),
    }),
  );
  app.post("/events/:id/history/:change/undo", async (c) =>
    c.json(await undoChange(db, c.req.param("id"), c.get("userId"), c.req.param("change"))),
  );
  app.post("/events/:id/history/:change/redo", async (c) =>
    c.json(await undoChange(db, c.req.param("id"), c.get("userId"), c.req.param("change"), true)),
  );

  // ------------------------------------------------------------ people
  app.get("/events/:id/members", async (c) =>
    c.json({ members: await listMembers(db, c.req.param("id"), c.get("userId")) }),
  );
  app.patch("/events/:id/members/:user", async (c) => {
    const patch = await body(
      c,
      z.object({ role: roleShape.optional(), side: z.string().max(60).nullable().optional() }),
    );
    await updateMember(db, c.req.param("id"), c.get("userId"), c.req.param("user"), patch);
    return c.json({ ok: true });
  });
  app.delete("/events/:id/members/:user", async (c) => {
    await removeMember(db, c.req.param("id"), c.get("userId"), c.req.param("user"));
    return c.json({ ok: true });
  });
  app.post("/events/:id/invites", async (c) => {
    const opts = await body(
      c,
      z.object({
        role: roleShape,
        side: z.string().max(60).nullable().optional(),
        maxUses: z.number().int().min(1).max(500).nullable().optional(),
      }),
    );
    return c.json(await createInvite(db, c.req.param("id"), c.get("userId"), opts), 201);
  });
  app.post("/invites/:token/accept", async (c) =>
    c.json(await acceptInvite(db, c.req.param("token"), c.get("userId"))),
  );

  // ------------------------------------------------------------ comments
  app.get("/events/:id/comments", async (c) =>
    c.json({
      comments: await listComments(
        db,
        c.req.param("id"),
        c.get("userId"),
        c.req.query("type") ?? "task",
        c.req.query("record") ?? "",
      ),
    }),
  );
  app.post("/events/:id/comments", async (c) => {
    const input = await body(
      c,
      z.object({
        recordType: z.string().min(1).max(30),
        recordId: z.string().min(1).max(120),
        body: z.string().max(2000),
      }),
    );
    return c.json(await addComment(db, c.req.param("id"), c.get("userId"), input), 201);
  });
}
