import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { PlannrEvent } from "../src/data/types";
import type { EventAction } from "../src/shared/engine";
import { SyncQueue } from "../src/store/sync";
import type { Action } from "../src/store/types";

type Reply = { status: number; body?: unknown } | "offline";
let replies: ((path: string, init?: RequestInit) => Reply)[] = [];
let sent: { path: string; method: string; body?: unknown }[] = [];
const realFetch = globalThis.fetch;
const store = new Map<string, string>();

beforeEach(() => {
  sent = [];
  replies = [];
  store.clear();
  // Each request takes the next reply in line; the last one repeats.
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    sent.push({
      path,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = replies.length > 1 ? replies.shift() : replies[0];
    const r = next ? next(path, init) : { status: 200, body: {} };
    if (r === "offline") throw new TypeError("Failed to fetch");
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

/** Lets queued microtasks and the mocked requests finish. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

const tick = (id: string, taskId = "t1"): EventAction => ({ type: "toggleTask", eventId: id, taskId });
/** What the server sends back: only the id matters to the queue. */
const saved = (id: string, version: number) => ({
  event: { id } as unknown as PlannrEvent,
  version,
  role: "owner" as const,
  side: null,
});

function queue() {
  const seen: Action[] = [];
  return { q: new SyncQueue((a) => seen.push(a)), seen };
}

describe("syncing plan changes", () => {
  test("changes made together go in one request, then the server's copy replaces the plan", async () => {
    replies = [() => ({ status: 200, body: saved("e1", 7) })];
    const { q, seen } = queue();
    q.enqueue(tick("e1", "a"));
    q.enqueue(tick("e1", "b"));
    expect(q.has("e1")).toBe(true);
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ path: "/api/events/e1/actions", method: "POST" });
    expect(sent[0]?.body).toMatchObject({ actions: [{ taskId: "a" }, { taskId: "b" }] });
    expect(seen).toContainEqual({ type: "syncPlan", plan: saved("e1", 7) });
    expect(q.has("e1")).toBe(false);
    expect(q.pendingIds()).toEqual([]);
  });

  test("offline, changes wait and say so, then go when the connection is back", async () => {
    replies = [() => "offline", () => ({ status: 200, body: saved("e1", 2) })];
    const { q, seen } = queue();
    q.enqueue(tick("e1"));
    await settle();
    expect(seen).toContainEqual({ type: "syncStatus", patch: { pending: 1, offline: true } });
    expect(q.pendingIds()).toEqual(["e1"]);
    q.flushAll();
    await settle();
    expect(sent).toHaveLength(2);
    expect(seen.at(-1)).toEqual({ type: "syncStatus", patch: { pending: 0, offline: false } });
  });

  test("a change the server refuses is dropped, explained, and the saved plan put back", async () => {
    replies = [
      () => ({ status: 400, body: { error: "That task no longer exists" } }),
      () => ({ status: 200, body: saved("e1", 3) }),
    ];
    const { q, seen } = queue();
    q.enqueue(tick("e1"));
    await settle();
    expect(seen).toContainEqual({
      type: "toast",
      toast: { id: "sync-e1", text: "That task no longer exists" },
    });
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      "POST /api/events/e1/actions",
      "GET /api/events/e1",
    ]);
    expect(seen).toContainEqual({ type: "syncPlan", plan: saved("e1", 3) });
  });

  test("changes waiting offline survive a reload, for the same account only", async () => {
    replies = [() => "offline"];
    const first = queue().q;
    first.resume("user-a");
    first.enqueue(tick("e1"));
    await settle();
    expect(JSON.parse(store.get("plannr:outbox") ?? "{}").actions).toHaveLength(1);

    replies = [() => ({ status: 200, body: saved("e1", 4) })];
    sent = [];
    queue().q.resume("user-b");
    await settle();
    expect(sent).toHaveLength(0);
    queue().q.resume("user-a");
    await settle();
    expect(sent).toHaveLength(1);
    expect(store.has("plannr:outbox")).toBe(false);
  });

  test("signing out forgets everything waiting", async () => {
    replies = [() => "offline"];
    const { q } = queue();
    q.resume("user-a");
    q.enqueue(tick("e1"));
    await settle();
    q.forget();
    expect(q.pendingIds()).toEqual([]);
    expect(store.has("plannr:outbox")).toBe(false);
  });
});
