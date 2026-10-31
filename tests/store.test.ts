import { describe, expect, test } from "bun:test";
import { SEED_IDS } from "../src/data/demoMeta";
import { seedEvents } from "../src/data/seed";
import type { ActivityEntry } from "../src/shared/types";
import { initialState, reducer } from "../src/store/reducer";
import { demoLoading, migrate } from "../src/store/store";

const change = (at: string): ActivityEntry => ({
  id: at,
  eventId: "e1",
  eventName: "Wedding",
  kind: "action",
  summary: "Ticked off a task",
  at,
  by: "Rohan",
  mine: false,
});

describe("inbox", () => {
  test("opening it marks changes seen by the server's clock, not the device's", () => {
    const start = {
      ...initialState(),
      activity: [change("2031-01-02T10:00:00.000Z"), change("2031-01-01T10:00:00.000Z")],
    };
    const read = reducer(start, { type: "readNotifications" });
    expect(read.inboxSeen).toBe("2031-01-02T10:00:00.000Z");
    // Nothing loaded yet: the last seen point stays put rather than jumping to the device's time.
    const empty = reducer({ ...read, activity: [] }, { type: "readNotifications" });
    expect(empty.inboxSeen).toBe("2031-01-02T10:00:00.000Z");
  });
});

describe("saved state", () => {
  test("an account's saved plans are never mixed with the demo seed", () => {
    const saved = { ...initialState(), mode: "account" as const, events: [], demoShift: -999 };
    const loaded = migrate(saved);
    expect(loaded.events).toEqual([]);
    expect(loaded.mode).toBe("account");
  });
});

describe("the demo's sample events", () => {
  test("load only once someone opens the demo, and never into an account", () => {
    const visitor = initialState();
    expect(visitor.events).toEqual([]);
    expect(demoLoading(visitor)).toBe(false);
    const opened = reducer(visitor, { type: "enterDemo" });
    expect(demoLoading(opened)).toBe(true);
    const seeded = reducer(opened, { type: "seedDemo", events: seedEvents() });
    expect(demoLoading(seeded)).toBe(false);
    expect(seeded.events.map((e) => e.id)).toEqual(SEED_IDS);
    const account = { ...seeded, mode: "account" as const, events: [] };
    expect(reducer(account, { type: "seedDemo", events: seedEvents() }).events).toEqual([]);
  });

  test("the ids the app knows before loading match the samples themselves", () => {
    expect(seedEvents().map((e) => e.id)).toEqual(SEED_IDS);
  });
});

describe("moving between the demo and an account", () => {
  const user = { id: "u1", name: "Priya Menon", email: "priya@example.com", isAnonymous: false };
  const demo = reducer(reducer(initialState(), { type: "enterDemo" }), {
    type: "seedDemo",
    events: seedEvents(),
  });

  test("signing in keeps plans made in the demo for importing, never the samples", () => {
    const mine = { ...seedEvents()[3], id: "my-anniversary", name: "Our anniversary" } as ReturnType<
      typeof seedEvents
    >[number];
    const withMine = reducer(demo, { type: "addEvent", event: mine });
    const signedIn = reducer(withMine, { type: "enterAccount", user });
    expect(signedIn.mode).toBe("account");
    expect(signedIn.events).toEqual([]);
    expect(signedIn.localImports.map((e) => e.id)).toEqual(["my-anniversary"]);
    expect(signedIn.session).toMatchObject({
      signedIn: true,
      name: "Priya Menon",
      initials: "PM",
      plan: "Free",
    });
    expect(reducer(signedIn, { type: "dropImport", id: "my-anniversary" }).localImports).toEqual([]);
  });

  test("the server's plans replace the list, and a newer copy of one replaces it in place", () => {
    const signedIn = reducer(demo, { type: "enterAccount", user });
    const [wedding, birthday] = seedEvents();
    if (!wedding || !birthday) throw new Error("seed has events");
    const loaded = reducer(signedIn, {
      type: "setPlans",
      plans: [
        { event: wedding, version: 3, role: "owner", side: "Bride's side" },
        { event: birthday, version: 1, role: "viewer", side: null },
      ],
    });
    expect(loaded.events.map((e) => e.id)).toEqual([wedding.id, birthday.id]);
    expect(loaded.remote[wedding.id]).toEqual({ version: 3, role: "owner", side: "Bride's side" });
    const renamed = { ...wedding, name: "Renamed" };
    const synced = reducer(loaded, { type: "syncPlan", plan: { event: renamed, version: 4 } });
    expect(synced.events[0]?.name).toBe("Renamed");
    // Role and side are kept when the server's copy doesn't say.
    expect(synced.remote[wedding.id]).toEqual({ version: 4, role: "owner", side: "Bride's side" });
  });

  test("signing out goes back to a fresh demo but keeps the unfinished draft", () => {
    const signedIn = reducer(demo, { type: "enterAccount", user });
    const drafting = reducer(signedIn, { type: "draft", patch: { guidedStep: 2 } });
    const out = reducer(drafting, { type: "leaveAccount" });
    expect(out.mode).toBe("demo");
    expect(out.account.status).toBe("signed-out");
    expect(out.draft.guidedStep).toBe(2);
    expect(reducer(out, { type: "draftReset" }).draft.guidedStep).toBe(0);
  });

  test("resetting the demo brings back the samples as they were", () => {
    const changed = reducer(demo, { type: "renameEvent", eventId: "ananya-rohan", name: "Changed" });
    const reset = reducer(changed, { type: "resetDemo" });
    expect(reset.events).toEqual([]);
    expect(demoLoading(reset)).toBe(true);
    const reseeded = reducer(reset, { type: "seedDemo", events: seedEvents() });
    expect(reseeded.events[0]?.name).toBe("Ananya & Rohan's wedding");
  });
});

describe("toasts and status", () => {
  test("a toast replaces one with the same id and goes when dismissed", () => {
    const one = reducer(initialState(), { type: "toast", toast: { id: "a", text: "Saved" } });
    const two = reducer(one, { type: "toast", toast: { id: "a", text: "Saved again" } });
    expect(two.toasts).toEqual([{ id: "a", text: "Saved again" }]);
    expect(reducer(two, { type: "dismissToast", id: "a" }).toasts).toEqual([]);
  });

  test("sync status and the session merge what changed", () => {
    const s = reducer(initialState(), { type: "syncStatus", patch: { pending: 3 } });
    expect(s.sync).toEqual({ pending: 3, offline: false });
    const named = reducer(s, { type: "updateSession", patch: { city: "Thrissur" } });
    expect(named.session.city).toBe("Thrissur");
    expect(reducer(named, { type: "signOut" }).session.signedIn).toBe(false);
  });
});
