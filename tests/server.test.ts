import { beforeAll, describe, expect, test } from "bun:test";
import { type App, createApp } from "../server/app";
import { createLocalDb } from "../server/db/local";
import { seedEvents } from "../src/data/seed";
import type { PersonalEvent } from "../src/data/types";

const ORIGIN = "http://localhost:5173";
let app: App;

/** A browser with its own cookie jar. */
class Client {
  cookies = new Map<string, string>();

  async call(path: string, init: { method?: string; body?: unknown } = {}) {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await app.request(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [name, ...rest] = (pair ?? "").split("=");
      if (name) this.cookies.set(name.trim(), rest.join("="));
    }
    const text = await res.text();
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read field by field
    return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
  }

  async guest() {
    const res = await this.call("/api/auth/sign-in/anonymous", { body: {} });
    expect(res.status).toBe(200);
    return res.json.user.id as string;
  }
}

const wedding = () => ({
  ...(seedEvents()[0] as PersonalEvent),
  id: `wedding-${crypto.randomUUID().slice(0, 8)}`,
});

beforeAll(async () => {
  app = createApp({ db: await createLocalDb(), env: { PLANNR_DEV_OUTBOX: "1" } });
});

describe("accounts", () => {
  test("lists the sign-in methods this server offers", async () => {
    const res = await new Client().call("/api/auth/methods");
    expect(res.json).toEqual({ guest: true, email: true, google: false });
  });

  test("plans need a session", async () => {
    expect((await new Client().call("/api/events")).status).toBe(401);
  });

  test("a guest gets a real account with a session", async () => {
    const priya = new Client();
    const id = await priya.guest();
    const me = await priya.call("/api/me");
    expect(me.json.user.id).toBe(id);
    expect(me.json.user.isAnonymous).toBe(true);
  });
});

describe("plans, history and undo", () => {
  test("changes are saved with history and can be undone and redone", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    const created = await priya.call("/api/events", { body: { event: ev } });
    expect(created.status).toBe(201);
    expect(created.json.role).toBe("owner");

    const task = ev.tasks.list[0];
    if (!task) throw new Error("seed has tasks");
    const applied = await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "toggleTask", eventId: "ignored", taskId: task.id }] },
    });
    expect(applied.status).toBe(200);
    expect(applied.json.version).toBe(2);
    expect(applied.json.event.tasks.list[0].done).toBe(true);

    const hist = await priya.call(`/api/events/${ev.id}/history`);
    const entry = hist.json.history[0];
    expect(entry.summary).toBe(`Ticked off “${task.title}”`);
    expect(entry.by).toBe("Guest planner");

    const undone = await priya.call(`/api/events/${ev.id}/history/${entry.id}/undo`, { body: {} });
    expect(undone.json.event.tasks.list[0].done).toBe(false);
    expect(undone.json.version).toBe(3);
    const again = await priya.call(`/api/events/${ev.id}/history/${entry.id}/undo`, { body: {} });
    expect(again.status).toBe(409);
    const redone = await priya.call(`/api/events/${ev.id}/history/${entry.id}/redo`, { body: {} });
    expect(redone.json.event.tasks.list[0].done).toBe(true);

    const latest = await priya.call(`/api/events/${ev.id}/history`);
    expect(latest.json.history.map((h: { kind: string }) => h.kind)).toEqual(["redo", "undo", "action"]);
  });

  test("undoing an older change keeps the later ones", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const [a, b] = ev.tasks.list;
    if (!a || !b) throw new Error("seed has tasks");
    await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: a.id }] },
    });
    await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: b.id }] },
    });
    const hist = await priya.call(`/api/events/${ev.id}/history`);
    const first = hist.json.history.find((h: { summary: string }) => h.summary.includes(a.title));
    const res = await priya.call(`/api/events/${ev.id}/history/${first.id}/undo`, { body: {} });
    const list = res.json.event.tasks.list as { id: string; done: boolean }[];
    expect(list.find((t) => t.id === a.id)?.done).toBe(false);
    expect(list.find((t) => t.id === b.id)?.done).toBe(true);
  });

  test("assistant messages are saved but stay out of the history", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "pushMessage", message: { id: "q1", role: "user", text: "Hi" } }] },
    });
    const plan = await priya.call(`/api/events/${ev.id}`);
    expect(plan.json.event.assistant.thread.at(-1).text).toBe("Hi");
    const hist = await priya.call(`/api/events/${ev.id}/history`);
    expect(hist.json.history).toEqual([]);
  });

  test("rejects unknown changes and oversized batches", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const bad = await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "dropTables" }] },
    });
    expect(bad.status).toBe(400);
    const many = Array.from({ length: 51 }, () => ({ type: "toggleTask", taskId: "x" }));
    expect((await priya.call(`/api/events/${ev.id}/actions`, { body: { actions: many } })).status).toBe(400);
  });
});

describe("planning together", () => {
  test("an invite brings someone in with the right role", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const invite = await priya.call(`/api/events/${ev.id}/invites`, {
      body: { role: "viewer", side: "Groom's side" },
    });
    expect(invite.status).toBe(201);

    const preview = await new Client().call(`/api/invites/${invite.json.token}`);
    expect(preview.json).toMatchObject({
      eventName: ev.name,
      role: "viewer",
      valid: true,
      invitedBy: "Guest planner",
    });

    const rohan = new Client();
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

  test("comments sit with the record they're about", async () => {
    const priya = new Client();
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

describe("upgrading a guest", () => {
  test("signing in by email code keeps the guest's plans", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });

    const email = `priya-${crypto.randomUUID().slice(0, 6)}@example.com`;
    const sent = await priya.call("/api/auth/email-otp/send-verification-otp", {
      body: { email, type: "sign-in" },
    });
    expect(sent.status).toBe(200);
    const { json } = await priya.call(`/api/dev/outbox/${email}`);
    expect(json.code).toMatch(/^\d{6}$/);
    const signedIn = await priya.call("/api/auth/sign-in/email-otp", { body: { email, otp: json.code } });
    expect(signedIn.status).toBe(200);

    const me = await priya.call("/api/me");
    expect(me.json.user.email).toBe(email);
    expect(me.json.user.isAnonymous).toBeFalsy();
    const plans = await priya.call("/api/events");
    expect(plans.json.plans.map((p: { event: { id: string } }) => p.event.id)).toEqual([ev.id]);
    expect(plans.json.plans[0].role).toBe("owner");
  });
});
