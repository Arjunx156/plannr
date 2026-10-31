/** The plan engine: tasks, notices, the assistant's thread, the event itself and history. */
import { describe, expect, test } from "bun:test";
import type { Message } from "../src/data/messageTypes";
import { describeAction } from "../src/shared/describeAction";
import { applyEventAction, type EventAction, isEventAction, replay, stamp } from "../src/shared/engine";
import { demo, noticedWedding, personal } from "./support";

const { events, wedding, birthday, mela, empty } = demo();

const noticed = noticedWedding();

describe("tasks", () => {
  test("toggle, add (once) and edit", () => {
    const t = wedding.tasks.list[0];
    if (!t) throw new Error("seed has tasks");
    const toggled = personal(
      applyEventAction(wedding, {
        type: "toggleTask",
        eventId: wedding.id,
        taskId: t.id,
      }),
    );
    expect(toggled.tasks.list[0]?.done).toBe(!t.done);
    const task = { id: "new", title: "Call the florist", who: "You", due: wedding.date, done: false };
    const added = personal(applyEventAction(wedding, { type: "addTask", eventId: wedding.id, task }));
    const twice = personal(applyEventAction(added, { type: "addTask", eventId: wedding.id, task }));
    expect(twice.tasks.list.filter((x) => x.id === "new")).toHaveLength(1);
    expect(twice.tasks.total).toBe(wedding.tasks.total + 1);
    const edited = personal(
      applyEventAction(added, {
        type: "updateTask",
        eventId: wedding.id,
        taskId: "new",
        patch: { who: "Rohan" },
      }),
    );
    expect(edited.tasks.list.find((x) => x.id === "new")?.who).toBe("Rohan");
  });
});

describe("notices", () => {
  test("resolving records the result and reopening clears it", () => {
    const n = noticed.notices[0];
    if (!n) throw new Error("has a notice");
    const done = personal(
      applyEventAction(noticed, {
        type: "resolveNotice",
        eventId: wedding.id,
        noticeId: n.id,
        status: "done",
        result: "Handled it",
      }),
    );
    expect(done.notices[0]).toMatchObject({ status: "done", result: "Handled it" });
    const reopened = personal(
      applyEventAction(done, {
        type: "reopenNotice",
        eventId: wedding.id,
        noticeId: n.id,
      }),
    );
    expect(reopened.notices[0]?.status).toBe("open");
    expect(reopened.notices[0]?.result).toBeUndefined();
  });
});

describe("the assistant thread", () => {
  test("messages are added once, and previews and actions are marked", () => {
    const message: Message = {
      id: "m-x",
      role: "ai",
      text: "Here's a preview",
      action: { label: "Do it", id: "add-tip", done: false },
      preview: { id: "p-x", title: "Move", tag: "Haldi", status: "pending", rows: [], change: "move-haldi" },
    };
    const pushed = applyEventAction(wedding, {
      type: "pushMessage",
      eventId: wedding.id,
      message,
    });
    const again = personal(
      applyEventAction(pushed, {
        type: "pushMessage",
        eventId: wedding.id,
        message,
      }),
    );
    expect(again.assistant.thread.filter((m) => m.id === "m-x")).toHaveLength(1);
    const applied = personal(
      applyEventAction(again, {
        type: "previewStatus",
        eventId: wedding.id,
        messageId: "m-x",
        status: "applied",
      }),
    );
    expect(applied.assistant.thread.find((m) => m.id === "m-x")?.preview?.status).toBe("applied");
    const acted = personal(
      applyEventAction(applied, {
        type: "messageActionDone",
        eventId: wedding.id,
        messageId: "m-x",
      }),
    );
    expect(acted.assistant.thread.find((m) => m.id === "m-x")?.action?.done).toBe(true);
  });
});

describe("the event itself", () => {
  test("archive, rename (never blank) and replace keep the event's identity", () => {
    expect(
      applyEventAction(wedding, { type: "archiveEvent", eventId: wedding.id, archived: true }).archived,
    ).toBe(true);
    expect(applyEventAction(wedding, { type: "renameEvent", eventId: wedding.id, name: "   " }).name).toBe(
      wedding.name,
    );
    expect(
      applyEventAction(wedding, { type: "renameEvent", eventId: wedding.id, name: " A & R " }).name,
    ).toBe("A & R");
    const replaced = applyEventAction(empty, { type: "replacePlan", eventId: empty.id, event: birthday });
    expect(replaced.id).toBe(empty.id);
    expect(replaced.layout).toBe("personal");
  });
});

describe("history", () => {
  const actions: EventAction[] = [
    { type: "addTip", eventId: wedding.id },
    { type: "applyGuestGrowth", eventId: wedding.id },
    { type: "renameEvent", eventId: wedding.id, name: "Ananya weds Rohan" },
  ];

  test("replaying the same actions always gives the same plan", () => {
    expect(replay(wedding, actions)).toEqual(replay(wedding, actions));
  });

  test("every action is described in words, before it applies", () => {
    const all: EventAction[] = [
      ...actions,
      { type: "orderCake", eventId: birthday.id },
      { type: "addStars", eventId: birthday.id },
      { type: "addAreca", eventId: mela.id },
      { type: "archiveEvent", eventId: wedding.id, archived: false },
      { type: "approveExpense", eventId: mela.id, approvalId: "a1", status: "declined" },
      { type: "assignShift", eventId: mela.id, role: "Gate", slot: 0, name: "Nikhil" },
      { type: "bookPhotographer", eventId: wedding.id, studio: "Frames", price: 1 },
      { type: "applyChange", eventId: wedding.id, change: "move-haldi" },
      { type: "applyChange", eventId: wedding.id, change: "cut-decor" },
      { type: "replacePlan", eventId: empty.id, event: birthday },
    ];
    for (const a of all) {
      const ev = events.find((e) => e.id === a.eventId) ?? wedding;
      const words = describeAction(a, ev);
      expect(words.length).toBeGreaterThan(8);
      expect(words).not.toContain("undefined");
    }
    const t = wedding.tasks.list[0];
    if (t)
      expect(describeAction({ type: "toggleTask", eventId: wedding.id, taskId: t.id }, wedding)).toContain(
        t.title,
      );
  });

  test("only known actions are accepted, and stamping keeps them replayable", () => {
    expect(isEventAction({ type: "addTip" })).toBe(true);
    expect(isEventAction({ type: "dropTables" })).toBe(false);
    const stamped = stamp({ type: "addTip", eventId: wedding.id }, "2026-09-27", "2026-09-27T10:00:00.000Z");
    expect(applyEventAction(wedding, stamped)).toEqual(applyEventAction(wedding, stamped));
  });
});
