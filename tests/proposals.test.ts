/**
 * What the assistant proposes, turned into plan changes: each kind of proposal becomes the change it
 * names, and one that points at something the plan doesn't have is dropped rather than guessed at.
 */
import { describe, expect, test } from "bun:test";
import type { AiProposal } from "../src/data/messageTypes";
import type { PlannrEvent } from "../src/data/types";
import { addDays, STORY_DAY } from "../src/lib/dates";
import { functionsOf } from "../src/shared/eventLists";
import { proposalActions, proposalRipple } from "../src/shared/proposals";
import { demo } from "./support";

const { wedding, mela, empty } = demo();
const now = STORY_DAY;
const [first, second] = wedding.tasks.list;
const haldi = functionsOf(wedding).find((f) => f.id === "haldi");
if (!first || !second || !haldi) throw new Error("the demo wedding has tasks and a haldi");

const actions = (p: AiProposal, ev: PlannrEvent = wedding) => proposalActions(ev, p, now);

describe("each kind of proposal", () => {
  test("a new task keeps its due date when it's before the event, and its function when the plan has it", () => {
    const [added] = actions({
      kind: "addTask",
      title: "Book the nadaswaram",
      who: "Rohan",
      due: now,
      fnId: "haldi",
    });
    expect(added).toMatchObject({
      type: "addTask",
      task: { title: "Book the nadaswaram", who: "Rohan", due: now, done: false, fn: "haldi" },
    });
  });

  test("a new task with no date, or one after the event, falls due a week out, never after the event", () => {
    const [undated] = actions({ kind: "addTask", title: "Order favours", fnId: "nowhere" });
    expect(undated).toMatchObject({ task: { due: addDays(now, 7), who: "You" } });
    expect(undated?.type === "addTask" && "fn" in undated.task).toBe(false);
    const [late] = actions({ kind: "addTask", title: "Order favours", due: addDays(wedding.date, 30) });
    expect(late).toMatchObject({ task: { due: addDays(now, 7) } });

    const soon = { ...wedding, date: addDays(now, 3) };
    const [squeezed] = actions({ kind: "addTask", title: "Order favours" }, soon);
    expect(squeezed).toMatchObject({ task: { due: soon.date } });
  });

  test("moving, completing and resizing name the record and only what changes", () => {
    expect(actions({ kind: "moveTask", taskId: first.id, due: addDays(first.due, 2) })).toEqual([
      { type: "updateTask", eventId: wedding.id, taskId: first.id, patch: { due: addDays(first.due, 2) } },
    ]);
    expect(actions({ kind: "completeTask", taskId: second.id })).toEqual([
      { type: "toggleTask", eventId: wedding.id, taskId: second.id },
    ]);
    expect(actions({ kind: "setHeadcount", guests: 320 })).toEqual([
      { type: "setHeadcount", eventId: wedding.id, guests: 320 },
    ]);
    expect(actions({ kind: "setBudgetLine", categoryId: "catering", amount: 480000 })).toEqual([
      {
        type: "updateRecord",
        eventId: wedding.id,
        coll: "categories",
        id: "catering",
        patch: { planned: 480000 },
      },
    ]);
    expect(actions({ kind: "moveFunction", fnId: "haldi", date: addDays(haldi.date, -1) })).toEqual([
      {
        type: "updateRecord",
        eventId: wedding.id,
        coll: "functions",
        id: "haldi",
        patch: { date: addDays(haldi.date, -1) },
      },
    ]);
  });

  test("notes, announcements and checklist items are added as new records", () => {
    expect(actions({ kind: "remember", text: "Ammachi needs a ramp" })).toMatchObject([
      { type: "addRecord", coll: "memory", record: { text: "Ammachi needs a ramp" } },
    ]);
    expect(actions({ kind: "announce", text: "Buses leave at 8" })).toMatchObject([
      { type: "addRecord", coll: "announcements", record: { text: "Buses leave at 8", at: "" } },
    ]);
    expect(actions({ kind: "addChecklist", label: "Pack the thalis", fnId: "haldi" })).toMatchObject([
      {
        type: "addRecord",
        coll: "checklist",
        record: { label: "Pack the thalis", done: false, fnId: "haldi" },
      },
    ]);
  });
});

describe("proposals that don't fit the plan", () => {
  test.each<[string, AiProposal]>([
    ["a task with no title", { kind: "addTask" }],
    ["moving a task that isn't there", { kind: "moveTask", taskId: "gone", due: "2027-01-01" }],
    ["moving a task to the day it's already due", { kind: "moveTask", taskId: first.id, due: first.due }],
    ["completing a task that isn't there", { kind: "completeTask", taskId: "gone" }],
    ["the headcount it already has", { kind: "setHeadcount", guests: wedding.guests }],
    ["a budget line that isn't there", { kind: "setBudgetLine", categoryId: "gone", amount: 1 }],
    ["a budget line with no amount", { kind: "setBudgetLine", categoryId: "catering" }],
    ["an empty note", { kind: "remember" }],
    ["an empty announcement", { kind: "announce" }],
    ["a function that isn't there", { kind: "moveFunction", fnId: "gone", date: "2027-01-01" }],
    ["a function to the day it's already on", { kind: "moveFunction", fnId: "haldi", date: haldi.date }],
    ["a checklist item with no label", { kind: "addChecklist" }],
  ])("%s is dropped", (_, p) => {
    expect(actions(p)).toEqual([]);
  });

  test("a completed task isn't completed again", () => {
    const done = { ...wedding, tasks: { ...wedding.tasks, list: [{ ...first, done: true }] } };
    expect(actions({ kind: "completeTask", taskId: first.id }, done)).toEqual([]);
  });

  test("a committee's event has no headcount to set, and an empty event takes no proposals", () => {
    expect(actions({ kind: "setHeadcount", guests: 900 }, mela)).toEqual([]);
    expect(actions({ kind: "remember", text: "Anything" }, empty)).toEqual([]);
  });

  test("a kind the model invented is dropped, never guessed at", () => {
    const invented = JSON.parse('{"kind":"cancelWedding"}');
    expect(proposalActions(wedding, invented, now)).toEqual([]);
  });
});

describe("the preview of what the assistant proposed", () => {
  test("a headcount change and a moved function get their richer previews", () => {
    const guests = proposalRipple(wedding, [{ kind: "setHeadcount", guests: 320 }], now);
    expect(guests?.lines.length).toBeGreaterThan(0);
    const moved = proposalRipple(
      wedding,
      [{ kind: "moveFunction", fnId: "haldi", date: addDays(haldi.date, -1) }],
      now,
    );
    expect(moved?.lines.length).toBeGreaterThan(0);
  });

  test("several proposals are counted together, and none that fit gives no preview", () => {
    const both = proposalRipple(
      wedding,
      [
        { kind: "remember", text: "No fireworks" },
        { kind: "completeTask", taskId: second.id },
      ],
      now,
    );
    expect(both?.title).toBe("2 proposed changes");
    expect(proposalRipple(wedding, [{ kind: "addTask" }], now)).toBeUndefined();
  });
});
