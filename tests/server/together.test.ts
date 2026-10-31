/** Planning together: co-planners and roles, the treasurer, templates and the AI allowance. */
import { describe, expect, test } from "bun:test";
import { spendAi } from "../../server/app";
import { createLocalDb } from "../../server/db/local";
import { demo, personal } from "../support";
import { Client, OWN_DB_MS, testApp, wedding } from "./fixtures";

const app = await testApp();

describe("planning together", () => {
  test("an invite brings someone in with the right role", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const invite = await priya.call(`/api/events/${ev.id}/invites`, {
      body: { role: "viewer", side: "Groom's side" },
    });
    expect(invite.status).toBe(201);

    const preview = await new Client(app).call(`/api/invites/${invite.json.token}`);
    expect(preview.json).toMatchObject({
      eventName: ev.name,
      role: "viewer",
      valid: true,
      invitedBy: "Guest planner",
    });

    const rohan = new Client(app);
    const rohanId = await rohan.guest();
    expect((await rohan.call(`/api/events/${ev.id}`)).status).toBe(404);
    const joined = await rohan.call(`/api/invites/${invite.json.token}/accept`, { body: {} });
    expect(joined.json).toEqual({ eventId: ev.id, role: "viewer" });
    expect((await rohan.call("/api/events")).json.plans).toHaveLength(1);

    const blocked = await rohan.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: ev.tasks.list[0]?.id }] },
    });
    expect(blocked.status).toBe(403);

    const promote = await priya.call(`/api/events/${ev.id}/members/${rohanId}`, {
      method: "PATCH",
      body: { role: "planner" },
    });
    expect(promote.status).toBe(200);
    const allowed = await rohan.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: ev.tasks.list[0]?.id }] },
    });
    expect(allowed.status).toBe(200);

    const people = await priya.call(`/api/events/${ev.id}/members`);
    expect(people.json.members.map((m: { role: string; side: string | null }) => [m.role, m.side])).toEqual([
      ["owner", null],
      ["planner", "Groom's side"],
    ]);

    // Planners can't change roles; nobody can remove the owner.
    const priyaId = people.json.members[0].userId;
    expect(
      (
        await rohan.call(`/api/events/${ev.id}/members/${rohanId}`, {
          method: "PATCH",
          body: { role: "viewer" },
        })
      ).status,
    ).toBe(403);
    expect((await rohan.call(`/api/events/${ev.id}/members/${priyaId}`, { method: "DELETE" })).status).toBe(
      400,
    );
  });

  test("a stronger invite raises a member's role, and a weaker one leaves it", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const rohan = new Client(app);
    await rohan.guest();
    const join = async (role: string) => {
      const invite = await priya.call(`/api/events/${ev.id}/invites`, { body: { role } });
      return (await rohan.call(`/api/invites/${invite.json.token}/accept`, { body: {} })).json;
    };
    expect(await join("viewer")).toEqual({ eventId: ev.id, role: "viewer" });
    expect(await join("planner")).toEqual({ eventId: ev.id, role: "planner" });
    expect(await join("viewer")).toEqual({ eventId: ev.id, role: "planner" });
  });

  test("the inbox shows co-planners' changes across plans", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const invite = await priya.call(`/api/events/${ev.id}/invites`, { body: { role: "planner" } });
    const rohan = new Client(app);
    await rohan.guest();
    await rohan.call("/api/auth/update-user", { body: { name: "Rohan" } });
    await rohan.call(`/api/invites/${invite.json.token}/accept`, { body: {} });
    await rohan.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "renameEvent", name: "Ananya & Rohan" }] },
    });
    const feed = await priya.call("/api/activity");
    expect(feed.json.activity[0]).toMatchObject({
      eventId: ev.id,
      eventName: "Ananya & Rohan",
      summary: "Renamed the event to “Ananya & Rohan”",
      by: "Rohan",
      mine: false,
    });
    expect((await new Client(app).call("/api/activity")).status).toBe(401);
  });

  test("comments sit with the record they're about", async () => {
    const priya = new Client(app);
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    await priya.call(`/api/events/${ev.id}/comments`, {
      body: { recordType: "task", recordId: "w4", body: "The combo package saves ₹25,000" },
    });
    const list = await priya.call(`/api/events/${ev.id}/comments?type=task&record=w4`);
    expect(list.json.comments[0]).toMatchObject({
      body: "The combo package saves ₹25,000",
      by: "Guest planner",
    });
  });
});

describe("the treasurer", () => {
  test("once named, only the treasurer or the owner approves expenses", async () => {
    const owner = new Client(app);
    await owner.guest();
    const mela = { ...demo().mela, id: `mela-${crypto.randomUUID().slice(0, 8)}` };
    await owner.call("/api/events", { body: { event: mela } });
    const join = async (side: string) => {
      const c = new Client(app);
      await c.guest();
      const invite = await owner.call(`/api/events/${mela.id}/invites`, { body: { role: "planner", side } });
      await c.call(`/api/invites/${invite.json.token}/accept`, { body: {} });
      return c;
    };
    const secretary = await join("Secretary");
    const pending = mela.funds.approvals.find((a) => a.status === "pending");
    const approve = (c: Client) =>
      c.call(`/api/events/${mela.id}/actions`, {
        body: {
          actions: [
            { type: "approveExpense", eventId: mela.id, approvalId: pending?.id, status: "approved" },
          ],
        },
      });
    // No treasurer yet: any planner can decide.
    const before = await secretary.call(`/api/events/${mela.id}/actions`, {
      body: {
        actions: [
          {
            type: "addTask",
            eventId: mela.id,
            task: { id: "t-x", title: "x", who: "You", due: mela.date, done: false },
          },
        ],
      },
    });
    expect(before.status).toBe(200);
    await join("Treasurer");
    expect((await approve(secretary)).status).toBe(403);
    expect((await approve(owner)).status).toBe(200);
  });
});

describe("templates", () => {
  test("next year's event starts from this year's plan, with answers and payments cleared", async () => {
    const c = new Client(app);
    await c.guest();
    const ev = wedding();
    await c.call("/api/events", { body: { event: ev } });
    const saved = await c.call(`/api/events/${ev.id}/template`, { body: { name: "Our wedding plan" } });
    expect(saved.status).toBe(201);
    const listed = await c.call("/api/templates");
    expect(listed.json.templates.map((t: { id: string }) => t.id)).toContain(saved.json.id);

    const nextDate = "2028-04-23";
    const made = await c.call(`/api/templates/${saved.json.id}/use`, {
      body: { name: "Cousin's wedding", date: nextDate },
    });
    expect(made.status).toBe(201);
    const next = personal(made.json.event);
    expect(next.id).not.toBe(ev.id);
    expect(next.date).toBe(nextDate);
    expect(next.name).toBe("Cousin's wedding");
    expect(next.tasks.list.every((t) => !t.done)).toBe(true);
    expect(next.budget.payments).toEqual([]);
    expect((next.households ?? []).every((h) => Object.keys(h.rsvp).length === 0)).toBe(true);
    // Every function moves by the same number of days as the event.
    const shift = (Date.parse(nextDate) - Date.parse(ev.date)) / 86400000;
    const before = ev.functions[0];
    const after = next.functions.find((f) => f.id === before?.id);
    if (before && after) expect((Date.parse(after.date) - Date.parse(before.date)) / 86400000).toBe(shift);

    // Someone else can't use it.
    const other = new Client(app);
    await other.guest();
    expect(
      (await other.call(`/api/templates/${saved.json.id}/use`, { body: { name: "x", date: nextDate } }))
        .status,
    ).toBe(404);
  });
});

describe("AI allowance", () => {
  test(
    "counts each call against the day and stops at the limit",
    async () => {
      const db = await createLocalDb();
      const key = `u:${crypto.randomUUID()}`;
      expect(await spendAi(db, key, 5, 6)).toBe(true);
      expect(await spendAi(db, key, 1, 6)).toBe(true);
      expect(await spendAi(db, key, 1, 6)).toBe(false);
      expect(await spendAi(db, `${key}-other`, 1, 6)).toBe(true);
    },
    OWN_DB_MS,
  );
});
