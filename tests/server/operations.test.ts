/** Running the service: morning reminders, the owner's view and encrypted backups. */
import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createApp } from "../../server/app";
import { createLocalDb } from "../../server/db/local";
import { bodyOf } from "../support";
import { Client, OWN_DB_MS, wedding } from "./fixtures";

describe("morning reminders", () => {
  test(
    "go to subscribed devices with what's due, and dropped devices are removed",
    async () => {
      const sent: { endpoint: string; title: string; body: string }[] = [];
      const db = await createLocalDb();
      const remindApp = createApp({
        db,
        env: { CRON_SECRET: "s3cret", VAPID_PUBLIC_KEY: "pub" },
        push: async (sub, msg) => {
          if (sub.endpoint.includes("gone")) return false;
          sent.push({ endpoint: sub.endpoint, title: msg.title, body: msg.body });
          return true;
        },
      });
      const priya = new Client(remindApp);
      await priya.guest();
      const ev = wedding();
      await priya.call("/api/events", { body: { event: ev } });
      expect((await priya.call("/api/push/key")).json.key).toBe("pub");
      const keys = { p256dh: "p256dh-key-value", auth: "auth-value" };
      expect(
        (await priya.call("/api/push", { body: { endpoint: "https://push.example/ok", keys } })).status,
      ).toBe(201);
      await priya.call("/api/push", { body: { endpoint: "https://push.example/gone", keys } });
      sent.length = 0;
      expect((await remindApp.request("/api/cron/daily")).status).toBe(401);
      const run = await remindApp.request("/api/cron/daily", { headers: { authorization: "Bearer s3cret" } });
      const { reminders: out, backup } = await bodyOf(
        run,
        z.object({
          reminders: z.object({ people: z.number(), sent: z.number(), removed: z.number() }),
          backup: z.object({ skipped: z.string().optional() }),
        }),
      );
      expect(out).toMatchObject({ people: 1, removed: 1 });
      expect(backup.skipped).toContain("BACKUP_KEY");
      // The seeded wedding has overdue tasks or payments, so the morning has something to say.
      expect(sent.length).toBe(out.sent);
      if (sent.length > 0) expect(sent[0]?.title).toContain(ev.name);
    },
    OWN_DB_MS,
  );
});

describe("the owner's view", () => {
  test(
    "counts plans and link opens without names, records errors, and is hidden from others",
    async () => {
      const db = await createLocalDb();
      const adminApp = createApp({ db, env: { ADMIN_EMAILS: "owner@example.com", PLANNR_DEV_OUTBOX: "1" } });
      const c = new Client(adminApp);
      await c.guest();
      const ev = wedding();
      await c.call("/api/events", { body: { event: ev } });
      const link = await c.call(`/api/events/${ev.id}/links`, { body: { kind: "site" } });
      await adminApp.request("/api/m", { method: "POST", body: JSON.stringify({ name: "visit" }) });
      await adminApp.request("/api/m", { method: "POST", body: JSON.stringify({ name: "anything-else" }) });
      await adminApp.request("/api/errors", {
        method: "POST",
        body: JSON.stringify({ message: "Boom", stack: "at x", url: "/events" }),
      });
      // A guest isn't an owner of the site.
      expect((await c.call("/api/admin/summary")).status).toBe(404);
      void link;
      const { adminSummary } = await import("../../server/admin");
      const s = await adminSummary(db);
      const names = s.days.map((d) => d.name).sort();
      expect(names).toContain("plan");
      expect(names).toContain("visit");
      expect(names).not.toContain("anything-else");
      expect(s.errors[0]?.message).toBe("Boom");
      expect(s.totals?.plans).toBe(1);
    },
    OWN_DB_MS,
  );
});

describe("backups", () => {
  test(
    "encrypt, decrypt and restore into an empty database",
    async () => {
      const db = await createLocalDb();
      const backupApp = createApp({ db, env: {} });
      const c = new Client(backupApp);
      await c.guest();
      const ev = wedding();
      await c.call("/api/events", { body: { event: ev } });
      await c.call(`/api/events/${ev.id}/actions`, {
        body: { actions: [{ type: "toggleTask", eventId: ev.id, taskId: ev.tasks.list[0]?.id }] },
      });
      const { exportTables, encrypt, decrypt, restore } = await import("../../server/backup");
      const key = randomBytes(32);
      const sealed = encrypt(await exportTables(db), key);
      // The plan's own words never appear in the stored bytes.
      expect(sealed.includes(Buffer.from(ev.name))).toBe(false);
      expect(() => decrypt(sealed, randomBytes(32))).toThrow();
      const tampered = Buffer.from(sealed);
      tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
      expect(() => decrypt(tampered, key)).toThrow();

      const backup = decrypt(sealed, key);
      expect(backup.tables["events"]?.length).toBe(1);
      expect(backup.tables["changes"]?.length).toBeGreaterThan(0);

      const fresh = await createLocalDb();
      const counts = await restore(fresh, backup);
      expect(counts["events"]).toBe(1);
      const again = await restore(fresh, backup);
      expect(again["events"]).toBe(1);
      const { events } = await import("../../server/db/schema");
      const rows = await fresh.select().from(events);
      expect(rows[0]?.data.name).toBe(ev.name);
      expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    },
    OWN_DB_MS,
  );
});
