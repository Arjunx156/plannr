import { describe, expect, test } from "bun:test";
import { seedEvents } from "../src/data/seed";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../src/data/types";
import { budgetTotals } from "../src/lib/metrics";
import {
  applyEventAction,
  describeAction,
  type EventAction,
  isEventAction,
  replay,
  stamp,
} from "../src/shared/engine";

const events = seedEvents();
const wedding = events.find((e) => e.id === "ananya-rohan") as PersonalEvent;
const birthday = events.find((e) => e.id === "aarav-6") as PersonalEvent;
const mela = events.find((e) => e.id === "green-valley-mela") as CommunityEvent;
const empty = events.find((e) => e.layout === "empty") as PlannrEvent;

/** The wedding with one open notice, as the overview would have raised it. */
const noticed: PersonalEvent = {
  ...wedding,
  notices: [
    {
      id: "guests-grew",
      tone: "warn",
      label: "18 more guests",
      text: "Catering needs 18 more plates",
      status: "open",
    },
  ],
};

const cat = (ev: PersonalEvent, id: string) => ev.budget.categories.find((c) => c.id === id);
const projected = (ev: PersonalEvent, id: string) => {
  const c = cat(ev, id);
  return c ? (c.projected ?? c.planned) : 0;
};

describe("tasks", () => {
  test("toggle, add (once) and edit", () => {
    const t = wedding.tasks.list[0];
    if (!t) throw new Error("seed has tasks");
    const toggled = applyEventAction(wedding, {
      type: "toggleTask",
      eventId: wedding.id,
      taskId: t.id,
    }) as PersonalEvent;
    expect(toggled.tasks.list[0]?.done).toBe(!t.done);
    const task = { id: "new", title: "Call the florist", who: "You", due: wedding.date, done: false };
    const added = applyEventAction(wedding, { type: "addTask", eventId: wedding.id, task }) as PersonalEvent;
    const twice = applyEventAction(added, { type: "addTask", eventId: wedding.id, task }) as PersonalEvent;
    expect(twice.tasks.list.filter((x) => x.id === "new")).toHaveLength(1);
    expect(twice.tasks.total).toBe(wedding.tasks.total + 1);
    const edited = applyEventAction(added, {
      type: "updateTask",
      eventId: wedding.id,
      taskId: "new",
      patch: { who: "Rohan" },
    }) as PersonalEvent;
    expect(edited.tasks.list.find((x) => x.id === "new")?.who).toBe("Rohan");
  });
});

describe("notices", () => {
  test("resolving records the result and reopening clears it", () => {
    const n = noticed.notices[0];
    if (!n) throw new Error("has a notice");
    const done = applyEventAction(noticed, {
      type: "resolveNotice",
      eventId: wedding.id,
      noticeId: n.id,
      status: "done",
      result: "Handled it",
    }) as PersonalEvent;
    expect(done.notices[0]).toMatchObject({ status: "done", result: "Handled it" });
    const reopened = applyEventAction(done, {
      type: "reopenNotice",
      eventId: wedding.id,
      noticeId: n.id,
    }) as PersonalEvent;
    expect(reopened.notices[0]?.status).toBe("open");
    expect(reopened.notices[0]?.result).toBeUndefined();
  });
});

describe("the assistant thread", () => {
  test("messages are added once, and previews and actions are marked", () => {
    const message = {
      id: "m-x",
      role: "ai" as const,
      text: "Here's a preview",
      action: { label: "Do it", done: false },
      preview: { title: "Move", status: "pending" as const, rows: [] },
    };
    const pushed = applyEventAction(wedding, {
      type: "pushMessage",
      eventId: wedding.id,
      // biome-ignore lint/suspicious/noExplicitAny: a minimal message for the reducer
      message: message as any,
    });
    const again = applyEventAction(pushed, {
      type: "pushMessage",
      eventId: wedding.id,
      // biome-ignore lint/suspicious/noExplicitAny: a minimal message for the reducer
      message: message as any,
    }) as PersonalEvent;
    expect(again.assistant.thread.filter((m) => m.id === "m-x")).toHaveLength(1);
    const applied = applyEventAction(again, {
      type: "previewStatus",
      eventId: wedding.id,
      messageId: "m-x",
      status: "applied",
    }) as PersonalEvent;
    expect(applied.assistant.thread.find((m) => m.id === "m-x")?.preview?.status).toBe("applied");
    const acted = applyEventAction(applied, {
      type: "messageActionDone",
      eventId: wedding.id,
      messageId: "m-x",
    }) as PersonalEvent;
    expect(acted.assistant.thread.find((m) => m.id === "m-x")?.action?.done).toBe(true);
  });
});

describe("budget", () => {
  test("a line item adds to the category's spending", () => {
    const item = { id: "li", name: "Garlands", vendor: "Market", amount: 4000, status: "paid" as const };
    const out = applyEventAction(wedding, {
      type: "addLineItem",
      eventId: wedding.id,
      categoryId: "decor",
      item,
      spent: 4000,
    }) as PersonalEvent;
    expect(cat(out, "decor")?.spent).toBe((cat(wedding, "decor")?.spent ?? 0) + 4000);
    expect(cat(out, "decor")?.items.some((i) => i.id === "li")).toBe(true);
  });

  test("categories can be added and changed", () => {
    const category = {
      id: "misc",
      name: "Misc",
      planned: 10000,
      spent: 0,
      status: "",
      tone: "idle" as const,
      items: [],
    };
    const added = applyEventAction(wedding, {
      type: "addCategory",
      eventId: wedding.id,
      category,
    }) as PersonalEvent;
    expect(budgetTotals(added.budget).planned).toBe(budgetTotals(wedding.budget).planned + 10000);
    const changed = applyEventAction(added, {
      type: "updateCategory",
      eventId: wedding.id,
      categoryId: "misc",
      patch: { planned: 5000 },
    }) as PersonalEvent;
    expect(cat(changed, "misc")?.planned).toBe(5000);
  });

  test("a tip is added once", () => {
    const once = applyEventAction(wedding, { type: "addTip", eventId: wedding.id }) as PersonalEvent;
    const twice = applyEventAction(once, { type: "addTip", eventId: wedding.id }) as PersonalEvent;
    expect(projected(twice, "gifts")).toBe(projected(wedding, "gifts") + 8000);
  });

  test("a bigger guest list raises catering and invitations, and settles its notice", () => {
    const out = applyEventAction(noticed, { type: "applyGuestGrowth", eventId: wedding.id }) as PersonalEvent;
    expect(projected(out, "catering")).toBe(projected(wedding, "catering") + 36288);
    expect(projected(out, "invitations")).toBe(projected(wedding, "invitations") + 2700);
    expect(out.notices.find((n) => n.id === "guests-grew")?.status).toBe("done");
  });
});

describe("one-tap suggestions", () => {
  test("booking the photographer books the vendor, prices the line and ticks the task", () => {
    const out = applyEventAction(wedding, {
      type: "bookPhotographer",
      eventId: wedding.id,
      studio: "Frames by Anoop",
      price: 165000,
      advanceDue: "2026-10-10",
    }) as PersonalEvent;
    expect(out.vendors.booked).toContain("Photography");
    expect(projected(out, "photo")).toBe(165000);
    expect(cat(out, "photo")?.status).toContain("10 Oct");
  });

  test("ordering the cake and swapping in stars change the birthday", () => {
    const cake = applyEventAction(birthday, { type: "orderCake", eventId: birthday.id }) as PersonalEvent;
    expect(cake.vendors.booked).toContain("Cake");
    expect(cake.tasks.list.find((t) => t.id === "b1")?.done).toBe(true);
    const stars = applyEventAction(birthday, { type: "addStars", eventId: birthday.id }) as PersonalEvent;
    expect(cat(stars, "decor")?.planned).toBe((cat(birthday, "decor")?.planned ?? 0) - 1800);
    expect(applyEventAction(stars, { type: "addStars", eventId: birthday.id })).toBe(stars);
  });

  test("areca plates add their tasks to a community event once", () => {
    const out = applyEventAction(mela, { type: "addAreca", eventId: mela.id }) as CommunityEvent;
    expect(out.tasks.list.filter((t) => t.id.startsWith("m-areca"))).toHaveLength(2);
    expect(applyEventAction(out, { type: "addAreca", eventId: mela.id })).toBe(out);
  });

  test("actions for another kind of event leave it as it was", () => {
    expect(applyEventAction(mela, { type: "orderCake", eventId: mela.id })).toBe(mela);
    expect(applyEventAction(wedding, { type: "addAreca", eventId: wedding.id })).toBe(wedding);
    expect(applyEventAction(empty, { type: "addTip", eventId: empty.id })).toBe(empty);
  });
});

describe("community", () => {
  test("approving an expense counts it as spent; deciding twice does nothing", () => {
    const pending = mela.funds.approvals.find((a) => a.status === "pending");
    if (!pending) throw new Error("seed has a pending approval");
    const out = applyEventAction(mela, {
      type: "approveExpense",
      eventId: mela.id,
      approvalId: pending.id,
      status: "approved",
    }) as CommunityEvent;
    expect(out.funds.spent).toBe(mela.funds.spent + pending.amount);
    const again = applyEventAction(out, {
      type: "approveExpense",
      eventId: mela.id,
      approvalId: pending.id,
      status: "declined",
    });
    expect(again).toBe(out);
  });

  test("a volunteer put on a shift joins the volunteer list once", () => {
    const role = mela.shifts.roles[0];
    if (!role) throw new Error("seed has shifts");
    const action = {
      type: "assignShift" as const,
      eventId: mela.id,
      role: role.role,
      slot: 0,
      name: "Nikhil",
    };
    const out = applyEventAction(applyEventAction(mela, action), action) as CommunityEvent;
    expect(out.volunteers.filter((v) => v === "Nikhil")).toHaveLength(1);
    expect(out.shifts.roles[0]?.slots[0]?.names.filter((n) => n === "Nikhil")).toHaveLength(1);
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
