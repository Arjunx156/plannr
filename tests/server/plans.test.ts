/** Plans: saving, changing, history and undo, and the checks every change passes. */
import { describe, expect, test } from "bun:test";
import { demo } from "../support";
import { Client, testApp, wedding } from "./fixtures";

const app = await testApp();

describe("plans, history and undo", () => {
  test("changes are saved with history and can be undone and redone", async () => {
    const priya = new Client(app);
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
    const priya = new Client(app);
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
    const list: { id: string; done: boolean }[] = res.json.event.tasks.list;
    expect(list.find((t) => t.id === a.id)?.done).toBe(false);
    expect(list.find((t) => t.id === b.id)?.done).toBe(true);
  });

  test("assistant messages are saved but stay out of the history", async () => {
    const priya = new Client(app);
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
    const priya = new Client(app);
    await priya.guest();
    const empty = demo().empty;
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
    const priya = new Client(app);
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

describe("checked changes", () => {
  test("badly shaped records are refused with a reason", async () => {
    const priya = new Client(app);
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
