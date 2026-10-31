/** Accounts: sign-in, email codes, guest upgrades and a person's own data. */
import { describe, expect, test } from "bun:test";
import { createApp } from "../../server/app";
import { signInMethods } from "../../server/auth";
import { rateLimit } from "../../server/db/authSchema";
import { createLocalDb } from "../../server/db/local";
import { errorOf, stubFetch } from "../support";
import { Client, ORIGIN, OWN_DB_MS, testApp, wedding } from "./fixtures";

const app = await testApp();

describe("accounts", () => {
  test("lists the sign-in methods this server offers", async () => {
    const res = await new Client(app).call("/api/auth/methods");
    expect(res.json).toEqual({ guest: true, email: true, google: false });
  });

  test("plans need a session", async () => {
    expect((await new Client(app).call("/api/events")).status).toBe(401);
  });

  test("changes from other sites are refused", async () => {
    const priya = new Client(app);
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
    // A browser that leaves Origin off still says where the request came from.
    const noOrigin = await app.request("/api/events", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
        cookie: [...priya.cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: JSON.stringify({ event: wedding() }),
    });
    expect(noOrigin.status).toBe(403);
  });

  test("a guest gets a real account with a session", async () => {
    const priya = new Client(app);
    const id = await priya.guest();
    const me = await priya.call("/api/me");
    expect(me.json.user.id).toBe(id);
    expect(me.json.user.isAnonymous).toBe(true);
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

  test(
    "in production, guest sign-ins are rate-limited through counters in the database",
    async () => {
      const db = await createLocalDb();
      const live = createApp({
        db,
        env: { PLANNR_ENV: "production", BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: ORIGIN },
      });
      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) {
        const res = await live.request("/api/auth/sign-in/anonymous", {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
          body: "{}",
        });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
      expect(statuses[20]).toBe(429);
      // Shared by every server instance, because it lives in the database rather than in memory.
      expect((await db.select().from(rateLimit)).length).toBeGreaterThan(0);
      // A fresh database and 21 real sign-ins: allow more than the 5 s default on a busy machine.
    },
    OWN_DB_MS,
  );

  test(
    "an address the mail service won't deliver to gets a clear message",
    async () => {
      const mailApp = createApp({
        db: await createLocalDb(),
        env: { RESEND_API_KEY: "test", EMAIL_FROM: "Plannr <codes@plannr.example>" },
      });
      const realFetch = globalThis.fetch;
      const sent: string[] = [];
      const restore = stubFetch(async (url, init) => {
        if (!String(url).startsWith("https://api.resend.com")) return realFetch(url, init);
        sent.push(String(init?.body));
        const refusal = { message: "You can only send testing emails to your own address" };
        return new Response(JSON.stringify(refusal), { status: 403 });
      });
      try {
        const res = await mailApp.request("/api/auth/email-otp/send-verification-otp", {
          method: "POST",
          headers: { origin: ORIGIN, "content-type": "application/json" },
          body: JSON.stringify({ email: "someone@example.com", type: "sign-in" }),
        });
        expect(res.status).toBe(400);
        expect(await errorOf(res)).toContain("Continue as a guest");
        expect(sent).toHaveLength(1);
      } finally {
        restore();
      }
    },
    OWN_DB_MS,
  );
});

describe("upgrading a guest", () => {
  test("signing in by email code keeps the guest's plans", async () => {
    const priya = new Client(app);
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

describe("your data", () => {
  test("export holds your plans; deleting hands shared plans to a co-planner", async () => {
    const owner = new Client(app);
    await owner.guest();
    const shared = wedding();
    const mine = wedding();
    await owner.call("/api/events", { body: { event: shared } });
    await owner.call("/api/events", { body: { event: mine } });
    const co = new Client(app);
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

describe("signed out", () => {
  test("asking who is signed in is a plain answer, not an error", async () => {
    const res = await new Client(app).call("/api/me");
    expect(res.status).toBe(200);
    expect(res.json.user).toBeNull();
  });
});
