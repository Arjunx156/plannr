import { describe, expect, test } from "bun:test";
import { checkPlan, parseAction } from "../server/validate";
import { seedEvents } from "../src/data/seed";
import type { PersonalEvent } from "../src/data/types";
import { EVENT_ACTION_TYPES } from "../src/shared/engine";

const wedding = () => structuredClone(seedEvents()[0] as PersonalEvent);
const error = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error);

describe("single changes", () => {
  test("a change type the plan engine doesn't know is refused", () => {
    expect(error(parseAction({ type: "dropTables" }))).toBe("Unknown change");
    expect(error(parseAction({ type: "toString" }))).toBe("Unknown change");
    expect(error(parseAction(null))).toBe("Unknown change");
  });

  test("every change the engine knows has a shape, so none passes unchecked", () => {
    for (const type of EVENT_ACTION_TYPES) expect(error(parseAction({ type }))).not.toBe("Unknown change");
  });

  test("task changes are checked field by field", () => {
    const task = { id: "t1", title: "Book the hall", who: "You", due: "2026-10-04", done: false };
    expect(parseAction({ type: "addTask", task }).ok).toBe(true);
    expect(error(parseAction({ type: "addTask", task: { ...task, title: "x".repeat(500) } }))).toStartWith(
      "task.title",
    );
    expect(error(parseAction({ type: "updateTask", taskId: "t1", patch: { due: "next week" } }))).toStartWith(
      "patch.due",
    );
  });

  test("unknown fields are dropped from a change", () => {
    const out = parseAction({ type: "toggleTask", taskId: "t1", sneaky: "<script>" });
    expect(out.ok && (out.action as unknown)).toEqual({ type: "toggleTask", taskId: "t1" });
  });

  test("an assistant message is bounded, proposals included", () => {
    const message = { id: "m1", role: "ai", text: "Done." };
    expect(parseAction({ type: "pushMessage", message }).ok).toBe(true);
    expect(parseAction({ type: "pushMessage", message: { ...message, role: "system" } }).ok).toBe(false);
    const flood = Array.from({ length: 20 }, () => ({ kind: "addTask", title: "x" }));
    expect(parseAction({ type: "pushMessage", message: { ...message, proposals: flood } }).ok).toBe(false);
  });

  test("a vendor saved with its country code keeps its leading +", () => {
    const vendor = { id: "v1", category: "Sound", name: "Kochi Sounds", stage: "needed", quotes: [] };
    expect(
      parseAction({ type: "addRecord", coll: "vendors", record: { ...vendor, phone: "+919847031212" } }).ok,
    ).toBe(true);
    expect(
      parseAction({ type: "addRecord", coll: "vendors", record: { ...vendor, phone: "98470 31212" } }).ok,
    ).toBe(false);
  });

  test("a new draft in place of a plan gets the whole-plan checks", () => {
    const ev = wedding();
    expect(parseAction({ type: "replacePlan", event: ev }).ok).toBe(true);
    ev.tasks.list = [{ id: "t1", title: "", who: "You", due: "2026-10-04", done: false }];
    expect(error(parseAction({ type: "replacePlan", event: ev }))).toStartWith("tasks");
  });
});

describe("whole plans", () => {
  test("every demo plan passes", () => {
    for (const ev of seedEvents()) expect(error(checkPlan(ev))).toBeUndefined();
  });

  test("a plan needs its outline", () => {
    const { date: _date, ...undated } = wedding();
    expect(error(checkPlan(undated))).toStartWith("date");
  });

  test("records inside a plan are held to the same shapes as single changes", () => {
    const ev = wedding();
    ev.budget.payments = [{ id: "p1", date: "soon", label: "Advance", amount: -5, paid: false }];
    expect(error(checkPlan(ev))).toStartWith("payments");
  });

  test("an oversized or deeply nested field is refused", () => {
    expect(error(checkPlan({ ...wedding(), eyebrow: "x".repeat(20_000) }))).toContain("too large");
    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 20; i++) deep = { deep };
    expect(error(checkPlan({ ...wedding(), extra: deep }))).toContain("too deep");
  });
});
