/** Shared links: what each link shows, what it may change, and album uploads. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createApp } from "../../server/app";
import { createLocalDb } from "../../server/db/local";
import { bodyOf, demo } from "../support";
import { Client, OWN_DB_MS, testApp, wedding } from "./fixtures";

const app = await testApp();

describe("shared links", () => {
  const mela = () => ({
    ...demo().mela,
    id: `mela-${crypto.randomUUID().slice(0, 8)}`,
  });

  test("links stop working a month after the event, but the album and fund report last longer", async () => {
    const rekha = new Client(app);
    await rekha.guest();
    const past = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const ev = { ...mela(), date: past };
    await rekha.call("/api/events", { body: { event: ev } });
    const shifts = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "shifts" } });
    const fund = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "fund" } });
    const expired = await new Client(app).call(`/api/p/${shifts.json.token}`);
    expect(expired.status).toBe(410);
    expect(expired.json.error).toContain("expired");
    expect((await new Client(app).call(`/api/p/${fund.json.token}`)).status).toBe(200);
  });

  test("an RSVP link answers for its own household only, and history names them", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const [nair, other] = (ev.households ?? []).filter((h) => h.functions.includes("ceremony"));
    if (!nair || !other) throw new Error("seed has households");
    const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "rsvp", target: nair.id } });
    expect(link.status).toBe(201);
    const again = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "rsvp", target: nair.id } });
    expect(again.json.token).toBe(link.json.token);

    const guest = new Client(app);
    const view = await guest.call(`/api/p/${link.json.token}`);
    expect(view.json.kind).toBe("rsvp");
    expect(view.json.household.name).toBe(nair.name);
    // Only the functions they're invited to, and nothing about other households.
    expect(view.json.event.functions.map((f: { id: string }) => f.id)).toEqual(nair.functions);
    expect(JSON.stringify(view.json)).not.toContain(other.name);

    const answers = Object.fromEntries(nair.functions.map((f) => [f, { status: "yes", count: 2 }]));
    const replied = await guest.call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "rsvp", householdId: nair.id, answers, meal: "veg" }] },
    });
    expect(replied.status).toBe(200);
    expect(replied.json.household.rsvp[nair.functions[0] ?? ""]).toEqual({ status: "yes", count: 2 });

    // Naming another household changes nothing for them: the link answers for its own.
    await guest.call(`/api/p/${link.json.token}/actions`, {
      body: {
        actions: [
          { type: "rsvp", householdId: other.id, answers: { reception: { status: "no", count: 0 } } },
        ],
      },
    });
    const plan = await priya.call(`/api/events/${ev.id}`);
    const otherNow = plan.json.event.households.find((h: { id: string }) => h.id === other.id);
    expect(otherNow.rsvp).toEqual(other.rsvp);
    const toggle = await guest.call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: ev.tasks.list[0]?.id }] },
    });
    expect(toggle.status).toBe(403);

    const hist = await priya.call(`/api/events/${ev.id}/history`);
    const replies = hist.json.history.filter((h: { by: string }) => h.by === `${nair.name} (RSVP)`);
    expect(replies[0].summary).toBe(`${nair.name} can't come to Reception`);
    expect(replies[1].summary).toMatch(
      new RegExp(`^${nair.name} replied: 2 coming to .*Ceremony, Reception$`),
    );
  });

  test("a helper sees and ticks only their own tasks", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const link = await priya.call(`/api/events/${ev.id}/links`, {
      body: { kind: "helper", target: "Suresh" },
    });
    const view = await new Client(app).call(`/api/p/${link.json.token}`);
    const mine = ev.tasks.list.filter((t) => t.who.split(/,\s*/).includes("Suresh"));
    expect(view.json.tasks.map((t: { id: string }) => t.id).sort()).toEqual(mine.map((t) => t.id).sort());
    const notMine = ev.tasks.list.find((t) => !t.who.includes("Suresh"));
    const blocked = await new Client(app).call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: notMine?.id }] },
    });
    expect(blocked.status).toBe(403);
    const ok = await new Client(app).call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: mine[0]?.id }] },
    });
    expect(ok.status).toBe(200);
    const act = (action: Record<string, unknown>) =>
      new Client(app).call(`/api/p/${link.json.token}/actions`, { body: { actions: [action] } });
    const tick = (id: string, patch: Record<string, unknown>) =>
      act({ type: "updateRecord", coll: "checklist", id, patch });
    expect((await tick("c3", { done: true })).status).toBe(200);
    expect((await tick("c3", { label: "Something else" })).status).toBe(403);
    expect((await tick("c1", { done: true })).status).toBe(403);
    expect((await act({ type: "renameEvent", eventId: ev.id, name: "Ours now" })).status).toBe(403);
  });

  test("volunteers sign up for open shifts; full ones say so", async () => {
    const rekha = new Client(app);
    await rekha.guest();
    const ev = mela();
    await rekha.call("/api/events", { body: { event: ev } });
    const link = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "shifts" } });
    const sign = (role: string, slot: number) =>
      new Client(app).call(`/api/p/${link.json.token}/actions`, {
        body: { actions: [{ type: "assignShift", role, slot, name: "Neha Varma" }] },
      });
    const ok = await sign("Food safety", 1);
    expect(ok.status).toBe(200);
    const food = ok.json.roles.find((r: { role: string }) => r.role === "Food safety");
    expect(food.slots[1].names).toContain("Neha");
    const full = await sign("Entry & passes", 0);
    expect(full.status).toBe(403);
    expect(full.json.error).toBe("That shift is already full");
  });

  test("a stall request pays the event's fee and waits for the committee", async () => {
    const rekha = new Client(app);
    await rekha.guest();
    const ev = mela();
    await rekha.call("/api/events", { body: { event: ev } });
    const link = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "stalls" } });
    const res = await new Client(app).call(`/api/p/${link.json.token}/actions`, {
      body: {
        actions: [
          {
            type: "addRecord",
            coll: "stalls",
            record: { id: "x", name: "Dosa Corner", owner: "Usha", fee: 1, paid: true, status: "confirmed" },
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    const plan = await rekha.call(`/api/events/${ev.id}`);
    const stall = plan.json.event.stallList.find((s: { name: string }) => s.name === "Dosa Corner");
    expect(stall).toMatchObject({ fee: 2500, paid: false, status: "requested" });
    expect(stall.id).not.toBe("x");
  });

  test("the fund report shows totals, not who spent what", async () => {
    const rekha = new Client(app);
    await rekha.guest();
    const ev = mela();
    await rekha.call("/api/events", { body: { event: ev } });
    const link = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "fund" } });
    const view = await new Client(app).call(`/api/p/${link.json.token}`);
    expect(view.json.received).toBe(150000 + 40000 + 30000);
    expect(view.json.pending.count).toBe(2);
    expect(JSON.stringify(view.json)).not.toContain("Arjun");
    const write = await new Client(app).call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "approveExpense", approvalId: "a1", status: "approved" }] },
    });
    expect(write.status).toBe(403);
  });

  test("the event website is hidden until it's published", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "site" } });
    expect(link.json.token).toMatch(/^ananya-rohans-wedding/);
    expect((await new Client(app).call(`/api/p/${link.json.token}`)).status).toBe(404);
    await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "updateEvent", patch: { site: { published: true } } }] },
    });
    const site = await new Client(app).call(`/api/p/${link.json.token}`);
    expect(site.json.kind).toBe("site");
    // Family-only functions stay off the website.
    expect(site.json.event.functions.map((f: { id: string }) => f.id)).toEqual(["ceremony", "reception"]);
    const renamed = await priya.call(`/api/events/${ev.id}/site-address`, {
      method: "PUT",
      body: { slug: `Ananya & Rohan ${ev.id.slice(-4)}` },
    });
    expect(renamed.json.token).toBe(`ananya-rohan-${ev.id.slice(-4)}`);
    expect((await new Client(app).call(`/api/p/${link.json.token}`)).status).toBe(404);
  });

  test("viewers can't make links; unknown links say so", async () => {
    expect((await new Client(app).call("/api/p/not-a-real-link")).status).toBe(404);
    expect((await app.request("/api/p/a%2F..%2Fx")).status).toBe(404);
  });
});

describe("album photos", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  test(
    "a guest adds a photo from the album link; the server stores it under the event",
    async () => {
      const stored: string[] = [];
      const photoApp = createApp({
        db: await createLocalDb(),
        env: {},
        photos: async (eventId, _bytes, type) => {
          stored.push(type);
          return `https://abc.public.blob.vercel-storage.com/albums/${eventId}/p.jpg`;
        },
      });
      const priya = new Client(photoApp);
      await priya.guest();
      const ev = wedding();
      await priya.call("/api/events", { body: { event: ev } });
      const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "album" } });
      const send = (body: BodyInit, by = "Anil") =>
        photoApp.request(`/api/p/${link.json.token}/photo?by=${by}`, {
          method: "POST",
          body,
          headers: { "content-type": "image/jpeg" },
        });
      expect((await send(new Uint8Array([1, 2, 3]))).status).toBe(415);
      expect((await send(jpeg, "A")).status).toBe(400);
      const ok = await send(jpeg);
      expect(ok.status).toBe(200);
      const view = await bodyOf(
        ok,
        z.object({ photos: z.array(z.object({ by: z.string(), url: z.string() })) }),
      );
      expect(view.photos[0]?.by).toBe("Anil");
      expect(stored).toEqual(["image/jpeg"]);
      // Pasting someone else's photo link into the album is refused.
      const sneaky = await priya.call(`/api/p/${link.json.token}/actions`, {
        body: {
          actions: [
            {
              type: "addRecord",
              coll: "album",
              record: { id: "x", url: "https://evil.public.blob.vercel-storage.com/a.jpg", by: "X", at: "" },
            },
          ],
        },
      });
      expect(sneaky.status).toBe(403);
    },
    OWN_DB_MS,
  );

  test("uploads are off until storage is connected", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "album" } });
    const res = await app.request(`/api/p/${link.json.token}/photo?by=Anil`, { method: "POST", body: jpeg });
    expect(res.status).toBe(503);
  });
});
