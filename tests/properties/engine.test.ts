/** Properties of the plan engine that must hold for any sequence of changes, not just the examples. */
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { applyEventAction, type EventAction, replay } from "../../src/shared/engine";
import { demo, personal } from "../support";

const { wedding } = demo();
const taskIds = wedding.tasks.list.map((t) => t.id);

/** A change a planner could make to the demo wedding: tick a task, add one, or rename one. */
const change: fc.Arbitrary<EventAction> = fc.oneof(
  fc.constantFrom(...taskIds).map((taskId) => ({ type: "toggleTask" as const, eventId: wedding.id, taskId })),
  fc.record({ id: fc.uuid(), title: fc.string({ minLength: 1, maxLength: 40 }) }).map(({ id, title }) => ({
    type: "addTask" as const,
    eventId: wedding.id,
    task: { id, title, who: "Priya", due: "2026-11-01", done: false },
  })),
  fc
    .record({ taskId: fc.constantFrom(...taskIds), title: fc.string({ minLength: 1, maxLength: 40 }) })
    .map(({ taskId, title }) => ({
      type: "updateTask" as const,
      eventId: wedding.id,
      taskId,
      patch: { title },
    })),
);

describe("the plan engine, for any sequence of changes", () => {
  test("never changes the plan it was given", () => {
    fc.assert(
      fc.property(fc.array(change, { maxLength: 20 }), (actions) => {
        const before = structuredClone(wedding);
        replay(wedding, actions);
        expect(wedding).toEqual(before);
      }),
    );
  });

  test("gives the same plan every time it replays the same history", () => {
    fc.assert(
      fc.property(fc.array(change, { maxLength: 20 }), (actions) => {
        expect(replay(wedding, actions)).toEqual(replay(structuredClone(wedding), actions));
      }),
    );
  });

  test("replaying a history in two parts is the same as replaying it whole", () => {
    fc.assert(
      fc.property(fc.array(change, { maxLength: 20 }), fc.nat(20), (actions, cut) => {
        const head = actions.slice(0, cut);
        const tail = actions.slice(cut);
        expect(replay(replay(wedding, head), tail)).toEqual(replay(wedding, actions));
      }),
    );
  });

  test("ticking a task twice leaves the plan as it was", () => {
    fc.assert(
      fc.property(fc.constantFrom(...taskIds), (taskId) => {
        const tick: EventAction = { type: "toggleTask", eventId: wedding.id, taskId };
        expect(applyEventAction(applyEventAction(wedding, tick), tick)).toEqual(wedding);
      }),
    );
  });

  test("an added task is on the list exactly once, however often the change is replayed", () => {
    fc.assert(
      fc.property(change, fc.integer({ min: 1, max: 4 }), (action, times) => {
        if (action.type !== "addTask") return;
        const plan = personal(
          replay(
            wedding,
            Array.from({ length: times }, () => action),
          ),
        );
        expect(plan.tasks.list.filter((t) => t.id === action.task.id)).toHaveLength(1);
      }),
    );
  });
});
