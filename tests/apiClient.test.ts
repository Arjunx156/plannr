import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type App, createApp } from "../server/app";
import { createLocalDb } from "../server/db/local";
import { seedEvents } from "../src/data/seed";
import type { PersonalEvent } from "../src/data/types";
import { ApiError, api } from "../src/lib/api";
import { list } from "../src/shared/records";

/**
 * The browser's API client against the real server, in one process: every call here goes
 * through src/lib/api.ts and server/app.ts unchanged, so the two can't drift apart. The
 * browser's fetch is stood in for by one that keeps a cookie jar, as a browser would.
 */

const ORIGIN = "http://localhost:5173";
const realFetch = globalThis.fetch;
let app: App;
let jar = new Map<string, string>();
let online = true;

beforeAll(async () => {
  app = createApp({ db: await createLocalDb(), env: { PLANNR_DEV_OUTBOX: "1" } });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (!online) throw new TypeError("Failed to fetch");
    const headers = new Headers(init?.headers);
    headers.set("origin", ORIGIN);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await app.request(String(input), { ...init, headers });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair = ""] = cookie.split(";");
      const [name = "", ...value] = pair.split("=");
      if (name) jar.set(name.trim(), value.join("="));
    }
    return res;
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

/** A fresh browser: no cookies, signed in as a new guest. */
async function newGuest(name: string) {
  jar = new Map();
  await api.signInGuest();
  await api.rename(name);
  return api.me();
}

const wedding = (): PersonalEvent => ({
  ...(seedEvents()[0] as PersonalEvent),
  id: `wedding-${crypto.randomUUID().slice(0, 8)}`,
});

describe("accounts", () => {
  test("a guest signs in, is named, and can sign out", async () => {
    expect(await api.methods()).toMatchObject({ guest: true });
    const me = await newGuest("Priya");
    expect(me).toMatchObject({ name: "Priya", isAnonymous: true });
    await api.signOut();
    expect(await api.me()).toBeNull();
  });

  test("a failed call carries the server's status and message", async () => {
    jar = new Map();
    const err = await api.plans().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });

  test("offline, a call fails with status 0 and a message for the person", async () => {
    online = false;
    try {
      const err = await api.plans().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(0);
      expect((err as ApiError).message).toContain("offline");
      // Sign-in methods fall back to "none" rather than breaking the sign-in page.
      expect(await api.methods()).toEqual({ guest: false, email: false, google: false });
    } finally {
      online = true;
    }
  });
});

describe("a plan, from creation to undo", () => {
  test("create, change, read the history, undo and redo", async () => {
    await newGuest("Ananya");
    const ev = wedding();
    const created = await api.createPlan(ev);
    expect(created).toMatchObject({ version: 1, role: "owner" });
    expect((await api.plans()).map((p) => p.event.id)).toContain(ev.id);

    const task = ev.tasks.list[0];
    if (!task) throw new Error("the demo wedding has tasks");
    const changed = await api.actions(ev.id, [{ type: "toggleTask", eventId: ev.id, taskId: task.id }]);
    expect(changed.version).toBe(2);
    expect(await api.version(ev.id)).toBe(2);

    const [entry] = await api.history(ev.id);
    if (!entry) throw new Error("the change is in the history");
    const undone = await api.undo(ev.id, entry.id);
    expect(undone.event.layout === "personal" && undone.event.tasks.list[0]?.done).toBe(task.done);
    const redone = await api.undo(ev.id, entry.id, true);
    expect(redone.event.layout === "personal" && redone.event.tasks.list[0]?.done).toBe(!task.done);
    expect((await api.plan(ev.id)).version).toBe(redone.version);
  });

  test("comments on a record are kept and listed", async () => {
    await newGuest("Rohan");
    const ev = wedding();
    await api.createPlan(ev);
    const task = ev.tasks.list[0];
    if (!task) throw new Error("the demo wedding has tasks");
    await api.addComment(ev.id, "task", task.id, "Asked the caterer for a tasting date");
    const comments = await api.comments(ev.id, "task", task.id);
    expect(comments.map((c) => c.body)).toEqual(["Asked the caterer for a tasting date"]);
  });
});

describe("working together", () => {
  test("an invite is previewed, accepted, and the new member can be made a viewer", async () => {
    await newGuest("Ananya");
    const ev = wedding();
    await api.createPlan(ev);
    const { token } = await api.createInvite(ev.id, "planner", "Groom's side");
    const ownerJar = jar;

    await newGuest("Rohan");
    expect(await api.invite(token)).toMatchObject({ valid: true, role: "planner", eventName: ev.name });
    const joined = await api.acceptInvite(token);
    expect(joined).toMatchObject({ eventId: ev.id, role: "planner" });
    const rohan = (await api.me())?.id;

    jar = ownerJar;
    const members = await api.members(ev.id);
    expect(members.map((m) => m.name).sort()).toEqual(["Ananya", "Rohan"]);
    await api.updateMember(ev.id, rohan ?? "", { role: "viewer" });
    expect((await api.members(ev.id)).find((m) => m.userId === rohan)?.role).toBe("viewer");
  });

  test("a shared RSVP link shows one household and takes its answer", async () => {
    await newGuest("Ananya");
    const ev = wedding();
    await api.createPlan(ev);
    const h = list(ev, "households")[0];
    if (!h) throw new Error("the demo wedding has households");
    const { token } = await api.linkFor(ev.id, "rsvp", h.id);
    expect((await api.links(ev.id)).some((l) => l.token === token)).toBe(true);

    jar = new Map();
    const view = await api.publicView(token);
    expect(view).toMatchObject({ kind: "rsvp", household: { name: h.name } });
    const answers = Object.fromEntries(h.functions.map((f) => [f, { status: "yes", count: 2 }]));
    const after = await api.publicActions(token, [{ type: "rsvp", householdId: "self", answers }]);
    expect(
      after.kind === "rsvp" && Object.values(after.household.rsvp).every((a) => a.status === "yes"),
    ).toBe(true);
  });
});

describe("templates", () => {
  test("an event saved as a template starts next year's event", async () => {
    await newGuest("Rekha");
    const ev = wedding();
    await api.createPlan(ev);
    await api.saveTemplate(ev.id, "Our wedding plan");
    const [template] = await api.templates();
    expect(template?.name).toBe("Our wedding plan");
    const next = await api.startFromTemplate(template?.id ?? "", "Next year", "2027-12-12");
    expect(next.event).toMatchObject({ name: "Next year", date: "2027-12-12" });
    await api.deleteTemplate(template?.id ?? "");
    expect(await api.templates()).toEqual([]);
  });
});
