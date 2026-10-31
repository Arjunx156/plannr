import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { deleteAccount, exportAccount } from "../account";
import { adminSummary, count, isAdmin, METRIC_NAMES } from "../admin";
import { pushSubs } from "../db/schema";
import { activity } from "../history";
import { HttpError } from "../plans";
import { type Api, body, type RouteDeps } from "./kit";

/** A browser's push subscription, as the Push API hands it over. */
const subShape = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://"), "Not a push address"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** The signed-in person's own things: their data, their reminders, their activity, and the owner's view. */
export function accountRoutes(app: Api, { db, env, auth, push }: RouteDeps): void {
  // The site owner's view; everyone else is told it doesn't exist.
  app.get("/admin/summary", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!isAdmin(env, session?.user.email)) throw new HttpError(404, "Not found");
    return c.json({ ...(await adminSummary(db)), metrics: METRIC_NAMES });
  });

  app.get("/account/export", async (c) =>
    c.json(await exportAccount(db, c.get("userId")), 200, {
      "content-disposition": `attachment; filename="plannr-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    }),
  );
  app.post("/account/delete", async (c) => {
    await body(c, z.object({ confirm: z.literal("DELETE") }));
    return c.json(await deleteAccount(db, c.get("userId")));
  });

  // Morning reminders on this device.
  app.post("/push", async (c) => {
    if (!push) throw new HttpError(503, "Reminders aren't switched on yet");
    const sub = await body(c, subShape);
    const userId = c.get("userId");
    await db
      .insert(pushSubs)
      .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({
        target: pushSubs.endpoint,
        set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });
    await count(db, "push_on");
    await push(
      { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      {
        title: "Reminders are on",
        body: "Each morning Plannr will tell you what's due that day.",
        url: "/today",
        tag: "welcome",
      },
    ).catch(() => false);
    return c.json({ ok: true }, 201);
  });
  app.post("/push/remove", async (c) => {
    const { endpoint } = await body(c, z.object({ endpoint: z.string().max(1000) }));
    await db
      .delete(pushSubs)
      .where(and(eq(pushSubs.endpoint, endpoint), eq(pushSubs.userId, c.get("userId"))));
    return c.json({ ok: true });
  });

  app.get("/activity", async (c) => c.json({ activity: await activity(db, c.get("userId")) }));
}
