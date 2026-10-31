import { z } from "zod";
import { count, pruneErrors, recordError } from "../admin";
import { devOutbox, isProduction, mailFailure, signInMethods } from "../auth";
import { nightlyBackup } from "../backup";
import { pruneLimits } from "../limits";
import { publicActions } from "../linkActions";
import { albumEvent, publicView } from "../links";
import { previewInvite } from "../members";
import { HttpError } from "../plans";
import { sendReminders } from "../reminders";
import { type Api, body, clientIp, type RouteDeps } from "./kit";

/**
 * Routes anyone may call without signing in: health, anonymous counts and crash reports,
 * sign-in itself, invite previews, shared links, the daily job and who-am-I.
 */
export function publicRoutes(app: Api, deps: RouteDeps): void {
  openRoutes(app, deps);
  signInRoutes(app, deps);
  sharedLinkRoutes(app, deps);
  dailyRoutes(app, deps);
  sessionRoutes(app, deps);
}

/** Health, anonymous counts and crash reports. */
function openRoutes(app: Api, { db, allow }: RouteDeps): void {
  app.get("/health", (c) => c.json({ ok: true }));

  // Daily counts with no one's identity, and crash reports from browsers.
  app.post("/m", async (c) => {
    if (!(await allow(`m:${clientIp(c)}`))) return c.body(null, 204);
    const raw = (await c.req.json().catch(() => ({}))) as { name?: string };
    if (raw.name === "visit") await count(db, "visit");
    return c.body(null, 204);
  });
  app.post("/errors", async (c) => {
    if (!(await allow(`e:${clientIp(c)}`))) return c.body(null, 204);
    const e = (await c.req.json().catch(() => ({}))) as { message?: unknown; stack?: unknown; url?: unknown };
    if (typeof e.message === "string" && e.message.trim())
      await recordError(db, {
        source: "client",
        message: e.message,
        stack: typeof e.stack === "string" ? e.stack : undefined,
        url: typeof e.url === "string" ? e.url : undefined,
        userAgent: c.req.header("user-agent"),
      });
    return c.body(null, 204);
  });
}

/** Signing in, the ways to do it, the development outbox, and invite previews. */
function signInRoutes(app: Api, { db, env, auth }: RouteDeps): void {
  app.get("/auth/methods", (c) => c.json(signInMethods(env)));
  if (!isProduction(env) && env.PLANNR_DEV_OUTBOX === "1")
    app.get("/dev/outbox/:email", (c) =>
      c.json({ code: devOutbox.get(c.req.param("email").toLowerCase()) ?? null }),
    );
  app.on(["GET", "POST"], "/auth/*", async (c) => {
    const failure: { message?: string } = {};
    const res = await mailFailure.run(failure, () => auth.handler(c.req.raw));
    return failure.message ? c.json({ error: failure.message }, 400) : res;
  });

  // Invite previews are public: someone opening the link may not have an account yet.
  app.get("/invites/:token", async (c) => c.json(await previewInvite(db, c.req.param("token"))));
}

/** Shared links: the page a link opens, and the answers sent from it. */
function sharedLinkRoutes(app: Api, { db, store, allow }: RouteDeps): void {
  // RSVPs, helpers, vendors, volunteers, fund reports. No account needed.
  app.get("/p/:token", async (c) =>
    c.json(await publicView(db, c.req.param("token")), 200, { "cache-control": "no-store" }),
  );
  app.post("/p/:token/actions", async (c) => {
    if (!(await allow(`p:${clientIp(c)}`)))
      return c.json({ error: "Too many changes at once. Wait a minute." }, 429);
    const { actions } = await body(c, z.object({ actions: z.array(z.unknown()).min(1).max(5) }));
    return c.json(await publicActions(db, c.req.param("token"), actions));
  });
  app.post("/p/:token/photo", async (c) => {
    if (!(await allow(`p:${clientIp(c)}`)))
      return c.json({ error: "Too many photos at once. Wait a minute." }, 429);
    const by = (c.req.query("by") ?? "").trim().slice(0, 80);
    if (by.length < 2) throw new HttpError(400, "Add your name, so the family knows whose photo it is");
    const token = c.req.param("token");
    const url = await store(await albumEvent(db, token), c.req.raw);
    const record = { id: "photo", url, by, at: "" };
    return c.json(await publicActions(db, token, [{ type: "addRecord", coll: "album", record }]));
  });
}

/** The 8:00 IST job: reminders, pruning and the nightly backup. */
function dailyRoutes(app: Api, { db, env, push }: RouteDeps): void {
  // Morning reminders, run once a day by Vercel Cron with the project's secret.
  app.get("/cron/daily", async (c) => {
    if (!env.CRON_SECRET || c.req.header("authorization") !== `Bearer ${env.CRON_SECRET}`)
      return c.json({ error: "Not allowed" }, 401);
    await Promise.all([pruneErrors(db), pruneLimits(db)]).catch((e: unknown) =>
      console.error("[cron] pruning failed:", e instanceof Error ? e.message : e),
    );
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const reminders = push
      ? await sendReminders(db, push, today)
      : { skipped: "Reminders aren't configured" };
    // The backup runs after the reminders, so a slow export never delays the morning message.
    const backup = await nightlyBackup(db, env).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      void recordError(db, { source: "server", message: `Backup failed: ${message}`, url: "cron/daily" });
      return { failed: message };
    });
    return c.json({ reminders, backup });
  });
}

/** Who is signed in, and the key a browser needs to subscribe to reminders. */
function sessionRoutes(app: Api, { env, auth, push }: RouteDeps): void {
  app.get("/push/key", (c) => c.json({ key: push ? (env.VAPID_PUBLIC_KEY ?? null) : null }));

  // Who is signed in, if anyone: a plain answer either way, so signed-out visitors see no errors.
  app.get("/me", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    return c.json({ user: session?.user ?? null }, 200, { "cache-control": "no-store" });
  });
}
