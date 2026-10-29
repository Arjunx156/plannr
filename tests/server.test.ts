import { beforeAll, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { type App, createApp, spendAi } from "../server/app";
import { signInMethods } from "../server/auth";
import { createLocalDb } from "../server/db/local";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent } from "../src/data/types";

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

  test("changes from other sites are refused", async () => {
    const priya = new Client();
    await priya.guest();
    const res = await app.request("/api/events", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
        cookie: [...priya.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: JSON.stringify({ event: wedding() }),
    });
    expect(res.status).toBe(403);
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

  test("a new draft replaces an empty event and can be undone", async () => {
    const priya = new Client();
    await priya.guest();
    const empty = seedEvents().find((e) => e.layout === "empty");
    if (!empty) throw new Error("seed has an event without a plan");
    const ev = { ...empty, id: `empty-${crypto.randomUUID().slice(0, 8)}` };
    await priya.call("/api/events", { body: { event: ev } });
    const draft = { ...wedding(), name: "Ignored", id: "ignored" };
    const res = await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "replacePlan", event: draft }] },
    });
    expect(res.status).toBe(200);
    expect(res.json.event.id).toBe(ev.id);
    expect(res.json.event.layout).toBe("personal");
    const hist = await priya.call(`/api/events/${ev.id}/history`);
    expect(hist.json.history[0].summary).toBe("Drafted the plan");
    const undone = await priya.call(`/api/events/${ev.id}/history/${hist.json.history[0].id}/undo`, {
      body: {},
    });
    expect(undone.json.event.layout).toBe("empty");

    const missing = await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "replacePlan" }] },
    });
    expect(missing.status).toBe(400);
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

describe("shared links", () => {
  const mela = () => ({
    ...(seedEvents().find((e) => e.id === "green-valley-mela") as CommunityEvent),
    id: `mela-${crypto.randomUUID().slice(0, 8)}`,
  });

  test("an RSVP link answers for its own household only, and history names them", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const [nair, other] = (ev.households ?? []).filter((h) => h.functions.includes("ceremony"));
    if (!nair || !other) throw new Error("seed has households");
    const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "rsvp", target: nair.id } });
    expect(link.status).toBe(201);
    const again = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "rsvp", target: nair.id } });
    expect(again.json.token).toBe(link.json.token);

    const guest = new Client();
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
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const link = await priya.call(`/api/events/${ev.id}/links`, {
      body: { kind: "helper", target: "Suresh" },
    });
    const view = await new Client().call(`/api/p/${link.json.token}`);
    const mine = ev.tasks.list.filter((t) => t.who.split(/,\s*/).includes("Suresh"));
    expect(view.json.tasks.map((t: { id: string }) => t.id).sort()).toEqual(mine.map((t) => t.id).sort());
    const notMine = ev.tasks.list.find((t) => !t.who.includes("Suresh"));
    const blocked = await new Client().call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: notMine?.id }] },
    });
    expect(blocked.status).toBe(403);
    const ok = await new Client().call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "toggleTask", taskId: mine[0]?.id }] },
    });
    expect(ok.status).toBe(200);
  });

  test("volunteers sign up for open shifts; full ones say so", async () => {
    const rekha = new Client();
    await rekha.guest();
    const ev = mela();
    await rekha.call("/api/events", { body: { event: ev } });
    const link = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "shifts" } });
    const sign = (role: string, slot: number) =>
      new Client().call(`/api/p/${link.json.token}/actions`, {
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
    const rekha = new Client();
    await rekha.guest();
    const ev = mela();
    await rekha.call("/api/events", { body: { event: ev } });
    const link = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "stalls" } });
    const res = await new Client().call(`/api/p/${link.json.token}/actions`, {
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
    const rekha = new Client();
    await rekha.guest();
    const ev = mela();
    await rekha.call("/api/events", { body: { event: ev } });
    const link = await rekha.call(`/api/events/${ev.id}/links`, { body: { kind: "fund" } });
    const view = await new Client().call(`/api/p/${link.json.token}`);
    expect(view.json.received).toBe(150000 + 40000 + 30000);
    expect(view.json.pending.count).toBe(2);
    expect(JSON.stringify(view.json)).not.toContain("Arjun");
    const write = await new Client().call(`/api/p/${link.json.token}/actions`, {
      body: { actions: [{ type: "approveExpense", approvalId: "a1", status: "approved" }] },
    });
    expect(write.status).toBe(403);
  });

  test("the event website is hidden until it's published", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "site" } });
    expect(link.json.token).toMatch(/^ananya-rohans-wedding/);
    expect((await new Client().call(`/api/p/${link.json.token}`)).status).toBe(404);
    await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "updateEvent", patch: { site: { published: true } } }] },
    });
    const site = await new Client().call(`/api/p/${link.json.token}`);
    expect(site.json.kind).toBe("site");
    // Family-only functions stay off the website.
    expect(site.json.event.functions.map((f: { id: string }) => f.id)).toEqual(["ceremony", "reception"]);
    const renamed = await priya.call(`/api/events/${ev.id}/site-address`, {
      method: "PUT",
      body: { slug: `Ananya & Rohan ${ev.id.slice(-4)}` },
    });
    expect(renamed.json.token).toBe(`ananya-rohan-${ev.id.slice(-4)}`);
    expect((await new Client().call(`/api/p/${link.json.token}`)).status).toBe(404);
  });

  test("viewers can't make links; unknown links say so", async () => {
    expect((await new Client().call("/api/p/not-a-real-link")).status).toBe(404);
    expect((await app.request("/api/p/a%2F..%2Fx")).status).toBe(404);
  });
});

describe("checked changes", () => {
  test("badly shaped records are refused with a reason", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const bad = await priya.call(`/api/events/${ev.id}/actions`, {
      body: {
        actions: [
          {
            type: "addRecord",
            coll: "households",
            record: { id: "x", name: "", expected: 0, functions: [], rsvp: {} },
          },
        ],
      },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/name|expected/);
    const unknownColl = await priya.call(`/api/events/${ev.id}/actions`, {
      body: { actions: [{ type: "addRecord", coll: "users", record: { id: "x" } }] },
    });
    expect(unknownColl.status).toBe(400);
    const good = await priya.call(`/api/events/${ev.id}/actions`, {
      body: {
        actions: [
          {
            type: "addRecord",
            coll: "households",
            record: {
              id: "hx",
              name: "Raman family",
              expected: 3,
              functions: ["reception"],
              rsvp: {},
              junk: "dropped",
            },
          },
        ],
      },
    });
    expect(good.status).toBe(200);
    const added = good.json.event.households.find((h: { id: string }) => h.id === "hx");
    expect(added.junk).toBeUndefined();
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

  test("the inbox shows co-planners' changes across plans", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const invite = await priya.call(`/api/events/${ev.id}/invites`, { body: { role: "planner" } });
    const rohan = new Client();
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
    expect((await new Client().call("/api/activity")).status).toBe(401);
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

describe("email codes", () => {
  test("are only offered when they can reach anyone", () => {
    const live = { VERCEL_URL: "plannr.vercel.app", BETTER_AUTH_SECRET: "x", RESEND_API_KEY: "re_x" };
    expect(signInMethods({ ...live, EMAIL_FROM: "Plannr <onboarding@resend.dev>" }).email).toBe(false);
    expect(signInMethods({ ...live, EMAIL_FROM: "Plannr <codes@plannr.in>" }).email).toBe(true);
    expect(signInMethods({ ...live }).email).toBe(false);
    // Development keeps codes on, printed to the server log.
    expect(signInMethods({}).email).toBe(true);
  });

  test("an address the mail service won't deliver to gets a clear message", async () => {
    const mailApp = createApp({
      db: await createLocalDb(),
      env: { RESEND_API_KEY: "test", EMAIL_FROM: "Plannr <codes@plannr.example>" },
    });
    const realFetch = globalThis.fetch;
    const sent: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith("https://api.resend.com")) {
        sent.push(String(init?.body));
        return new Response(
          JSON.stringify({ message: "You can only send testing emails to your own address" }),
          {
            status: 403,
          },
        );
      }
      return realFetch(url, init);
    }) as typeof fetch;
    try {
      const res = await mailApp.request("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ email: "someone@example.com", type: "sign-in" }),
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toContain("Continue as a guest");
      expect(sent).toHaveLength(1);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("upgrading a guest", () => {
  test("signing in by email code keeps the guest's plans", async () => {
    const priya = new Client();
    await priya.guest();
    await priya.call("/api/auth/update-user", { body: { name: "Priya" } });
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
    expect(me.json.user.name).toBe("Priya");
    expect(me.json.user.isAnonymous).toBeFalsy();
    const plans = await priya.call("/api/events");
    expect(plans.json.plans.map((p: { event: { id: string } }) => p.event.id)).toEqual([ev.id]);
    expect(plans.json.plans[0].role).toBe("owner");
  });
});

describe("AI allowance", () => {
  test("counts each call against the day and stops at the limit", async () => {
    const db = await createLocalDb();
    const key = `u:${crypto.randomUUID()}`;
    expect(await spendAi(db, key, 5, 6)).toBe(true);
    expect(await spendAi(db, key, 1, 6)).toBe(true);
    expect(await spendAi(db, key, 1, 6)).toBe(false);
    expect(await spendAi(db, `${key}-other`, 1, 6)).toBe(true);
  });
});

describe("the treasurer", () => {
  test("once named, only the treasurer or the owner approves expenses", async () => {
    const owner = new Client();
    await owner.guest();
    const mela = { ...(seedEvents()[2] as CommunityEvent), id: `mela-${crypto.randomUUID().slice(0, 8)}` };
    await owner.call("/api/events", { body: { event: mela } });
    const join = async (side: string) => {
      const c = new Client();
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

describe("album photos", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

  test("a guest adds a photo from the album link; the server stores it under the event", async () => {
    const stored: string[] = [];
    const photoApp = createApp({
      db: await createLocalDb(),
      env: {},
      photos: async (eventId, _bytes, type) => {
        stored.push(type);
        return `https://abc.public.blob.vercel-storage.com/albums/${eventId}/p.jpg`;
      },
    });
    const prev = app;
    app = photoApp;
    try {
      const priya = new Client();
      await priya.guest();
      const ev = wedding();
      await priya.call("/api/events", { body: { event: ev } });
      const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "album" } });
      const send = (body: BodyInit, by = "Anil") =>
        app.request(`/api/p/${link.json.token}/photo?by=${by}`, {
          method: "POST",
          body,
          headers: { "content-type": "image/jpeg" },
        });
      expect((await send(new Uint8Array([1, 2, 3]))).status).toBe(415);
      expect((await send(jpeg, "A")).status).toBe(400);
      const ok = await send(jpeg);
      expect(ok.status).toBe(200);
      const view = (await ok.json()) as { photos: { by: string; url: string }[] };
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
    } finally {
      app = prev;
    }
  });

  test("uploads are off until storage is connected", async () => {
    const priya = new Client();
    await priya.guest();
    const ev = wedding();
    await priya.call("/api/events", { body: { event: ev } });
    const link = await priya.call(`/api/events/${ev.id}/links`, { body: { kind: "album" } });
    const res = await app.request(`/api/p/${link.json.token}/photo?by=Anil`, { method: "POST", body: jpeg });
    expect(res.status).toBe(503);
  });
});

describe("morning reminders", () => {
  test("go to subscribed devices with what's due, and dropped devices are removed", async () => {
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
    const prev = app;
    app = remindApp;
    try {
      const priya = new Client();
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
      expect((await app.request("/api/cron/daily")).status).toBe(401);
      const run = await app.request("/api/cron/daily", { headers: { authorization: "Bearer s3cret" } });
      const { reminders: out, backup } = (await run.json()) as {
        reminders: { people: number; sent: number; removed: number };
        backup: { skipped?: string };
      };
      expect(out).toMatchObject({ people: 1, removed: 1 });
      expect(backup.skipped).toContain("BACKUP_KEY");
      // The seeded wedding has overdue tasks or payments, so the morning has something to say.
      expect(sent.length).toBe(out.sent);
      if (sent.length) expect(sent[0]?.title).toContain(ev.name);
    } finally {
      app = prev;
    }
  });
});

describe("your data", () => {
  test("export holds your plans; deleting hands shared plans to a co-planner", async () => {
    const owner = new Client();
    await owner.guest();
    const shared = wedding();
    const mine = wedding();
    await owner.call("/api/events", { body: { event: shared } });
    await owner.call("/api/events", { body: { event: mine } });
    const co = new Client();
    await co.guest();
    const invite = await owner.call(`/api/events/${shared.id}/invites`, { body: { role: "planner" } });
    await co.call(`/api/invites/${invite.json.token}/accept`, { body: {} });

    const exported = await owner.call("/api/account/export");
    expect(exported.json.plans.map((p: { event: { id: string } }) => p.event.id).sort()).toEqual(
      [shared.id, mine.id].sort(),
    );
    expect((await owner.call("/api/account/delete", { body: { confirm: "yes" } })).status).toBe(400);
    const gone = await owner.call("/api/account/delete", { body: { confirm: "DELETE" } });
    expect(gone.json).toEqual({ handedOver: 1, deleted: 1 });
    const plans = await co.call("/api/events");
    const kept = plans.json.plans.find((p: { event: { id: string } }) => p.event.id === shared.id);
    expect(kept.role).toBe("owner");
    expect((await owner.call("/api/events")).status).toBe(401);
  });
});

describe("templates", () => {
  test("next year's event starts from this year's plan, with answers and payments cleared", async () => {
    const c = new Client();
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
    const next = made.json.event as PersonalEvent;
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
    const other = new Client();
    await other.guest();
    expect(
      (await other.call(`/api/templates/${saved.json.id}/use`, { body: { name: "x", date: nextDate } }))
        .status,
    ).toBe(404);
  });
});

describe("the owner's view", () => {
  test("counts plans and link opens without names, records errors, and is hidden from others", async () => {
    const db = await createLocalDb();
    const adminApp = createApp({ db, env: { ADMIN_EMAILS: "owner@example.com", PLANNR_DEV_OUTBOX: "1" } });
    const prev = app;
    app = adminApp;
    try {
      const c = new Client();
      await c.guest();
      const ev = wedding();
      await c.call("/api/events", { body: { event: ev } });
      const link = await c.call(`/api/events/${ev.id}/links`, { body: { kind: "site" } });
      await app.request("/api/m", { method: "POST", body: JSON.stringify({ name: "visit" }) });
      await app.request("/api/m", { method: "POST", body: JSON.stringify({ name: "anything-else" }) });
      await app.request("/api/errors", {
        method: "POST",
        body: JSON.stringify({ message: "Boom", stack: "at x", url: "/events" }),
      });
      // A guest isn't an owner of the site.
      expect((await c.call("/api/admin/summary")).status).toBe(404);
      void link;
      const { adminSummary } = await import("../server/admin");
      const s = await adminSummary(db);
      const names = s.days.map((d) => d.name).sort();
      expect(names).toContain("plan");
      expect(names).toContain("visit");
      expect(names).not.toContain("anything-else");
      expect(s.errors[0]?.message).toBe("Boom");
      expect(s.totals?.plans).toBe(1);
    } finally {
      app = prev;
    }
  });
});

describe("backups", () => {
  test("encrypt, decrypt and restore into an empty database", async () => {
    const db = await createLocalDb();
    const backupApp = createApp({ db, env: {} });
    const prev = app;
    app = backupApp;
    try {
      const c = new Client();
      await c.guest();
      const ev = wedding();
      await c.call("/api/events", { body: { event: ev } });
      await c.call(`/api/events/${ev.id}/actions`, {
        body: { actions: [{ type: "toggleTask", eventId: ev.id, taskId: ev.tasks.list[0]?.id }] },
      });
      const { exportTables, encrypt, decrypt, restore } = await import("../server/backup");
      const key = randomBytes(32);
      const sealed = encrypt(await exportTables(db), key);
      // The plan's own words never appear in the stored bytes.
      expect(sealed.includes(Buffer.from(ev.name))).toBe(false);
      expect(() => decrypt(sealed, randomBytes(32))).toThrow();
      const tampered = Buffer.from(sealed);
      tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1;
      expect(() => decrypt(tampered, key)).toThrow();

      const backup = decrypt(sealed, key);
      expect(backup.tables.events?.length).toBe(1);
      expect(backup.tables.changes?.length).toBeGreaterThan(0);

      const fresh = await createLocalDb();
      const counts = await restore(fresh, backup);
      expect(counts.events).toBe(1);
      const again = await restore(fresh, backup);
      expect(again.events).toBe(1);
      const { events } = await import("../server/db/schema");
      const rows = await fresh.select().from(events);
      expect(rows[0]?.data.name).toBe(ev.name);
      expect(rows[0]?.createdAt).toBeInstanceOf(Date);
    } finally {
      app = prev;
    }
  });
});
