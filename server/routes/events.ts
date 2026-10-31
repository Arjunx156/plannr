import { z } from "zod";
import { addComment, listComments } from "../comments";
import { history, undoChange } from "../history";
import { isLinkKind, linkFor, listLinks, renameSite, revokeLink } from "../links";
import { acceptInvite, createInvite, listMembers, removeMember, updateMember } from "../members";
import { applyActions, createPlan, getPlan, HttpError, listPlans, planVersion, requireRole } from "../plans";
import { deleteTemplate, listTemplates, planFromTemplate, saveTemplate } from "../templates";
import { checkPlan, parseAction } from "../validate";
import { type Api, body, type RouteDeps } from "./kit";

/** The largest plan that can be created; the body cap in app.ts enforces it as the request streams in. */
export const MAX_EVENT_BYTES = 400 * 1024;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const roleShape = z.enum(["planner", "viewer"]);

/** Plans and everything inside one: changes, history, people, invites, links, templates and comments. */
export function eventRoutes(app: Api, deps: RouteDeps): void {
  planRoutes(app, deps);
  templateRoutes(app, deps);
  linkRoutes(app, deps);
  historyRoutes(app, deps);
  peopleRoutes(app, deps);
  commentRoutes(app, deps);
}

/** Creating plans, reading them and changing them. */
function planRoutes(app: Api, { db, store }: RouteDeps): void {
  app.get("/events", async (c) => c.json({ plans: await listPlans(db, c.get("userId")) }));
  app.post("/events", async (c) => {
    const { event } = await body(c, z.object({ event: z.unknown() }));
    const plan = checkPlan(event);
    if (!plan.ok) throw new HttpError(400, plan.error);
    return c.json(await createPlan(db, c.get("userId"), plan.event), 201);
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
    const { actions } = await body(c, z.object({ actions: z.array(z.unknown()).min(1).max(50) }));
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
}

/** Templates saved from one plan to start another. */
function templateRoutes(app: Api, { db }: RouteDeps): void {
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
}

/** Links that let guests, helpers and vendors open their part of a plan. */
function linkRoutes(app: Api, { db }: RouteDeps): void {
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
}

/** Every change made to a plan, and undoing or redoing one. */
function historyRoutes(app: Api, { db }: RouteDeps): void {
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
}

/** Co-planners, their roles, and invitations to join. */
function peopleRoutes(app: Api, { db }: RouteDeps): void {
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
}

/** Comments on tasks and records. */
function commentRoutes(app: Api, { db }: RouteDeps): void {
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
