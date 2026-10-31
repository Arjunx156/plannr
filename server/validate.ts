import { z } from "zod";
import type { PlannrEvent } from "../src/data/types";
import type { EventAction } from "../src/shared/engine";
import { isRecord, keysOf, oneOf } from "../src/shared/guards";
import { type Coll, isColl, list } from "../src/shared/records";
import { ACTIONS, task } from "./validation/actions";
import { iso, name } from "./validation/fields";
import { RECORDS } from "./validation/records";

/** The outline every plan must have; checkPlan checks the rest. */
const planOutline = z.object({
  id: z.string().min(3).max(120),
  kind: z.enum(["wedding", "birthday", "community", "other"]),
  layout: z.enum(["personal", "community", "empty"]),
  name: name(200),
  date: iso,
});

/** Bounds for a whole plan: deep and wide enough for any real one, not for a hostile one. */
const PLAN_LIMITS = { depth: 12, text: 10_000, items: 2_000 };

function withinLimits(v: unknown, depth = 0): boolean {
  if (depth > PLAN_LIMITS.depth) return false;
  if (typeof v === "string") return v.length <= PLAN_LIMITS.text;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length <= PLAN_LIMITS.items && v.every((x) => withinLimits(x, depth + 1));
  if (v && typeof v === "object") return Object.values(v).every((x) => withinLimits(x, depth + 1));
  return true;
}

/** The first problem with one of the plan's record collections, if any. */
function recordProblem(ev: PlannrEvent, c: Coll): string | undefined {
  let rows: unknown[];
  try {
    rows = list(ev, c);
  } catch {
    return `${c}: can't be read`;
  }
  const checked = z.array(RECORDS[c]).safeParse(rows);
  return checked.success ? undefined : `${c}: ${describe(checked.error)}`;
}

/**
 * Checks a whole plan, as it's created or put in place of a draft: its outline, its size, its tasks
 * and every record in it against the same shapes single changes are held to.
 */
export function checkPlan(raw: unknown): { ok: true; event: PlannrEvent } | { ok: false; error: string } {
  const outline = planOutline.safeParse(raw);
  if (!outline.success) return { ok: false, error: describe(outline.error) };
  if (!withinLimits(raw)) return { ok: false, error: "That plan has a field that's too large or too deep" };
  const ev = validated<PlannrEvent>(raw);
  const tasks = isRecord(raw) && isRecord(raw["tasks"]) ? raw["tasks"]["list"] : undefined;
  const checkedTasks = z.array(task).max(PLAN_LIMITS.items).optional().safeParse(tasks);
  if (!checkedTasks.success) return { ok: false, error: `tasks: ${describe(checkedTasks.error)}` };
  for (const c of keysOf(RECORDS)) {
    const problem = recordProblem(ev, c);
    if (problem) return { ok: false, error: problem };
  }
  return { ok: true, event: ev };
}

/** The one place checked input takes its type. */
function validated<T extends PlannrEvent | EventAction>(value: unknown): T {
  // Every field was just validated by zod shapes built from the same types, but zod's inferred
  // unions don't line up with Plannr's structurally, so the value is typed here once.
  return value as T;
}

/** Checks one change; returns it cleaned, or an error message a person can read. */
export function parseAction(raw: unknown): { ok: true; action: EventAction } | { ok: false; error: string } {
  const type = oneOf(isRecord(raw) ? raw["type"] : undefined, keysOf(ACTIONS));
  if (!type) return { ok: false, error: "Unknown change" };
  const parsed = ACTIONS[type].safeParse(raw);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const action: Record<string, unknown> = { ...parsed.data };
  if (action["type"] === "replacePlan") {
    const plan = checkPlan(action["event"]);
    if (!plan.ok) return plan;
  }
  // Records are checked against their own collection's shape.
  const coll = action["coll"];
  if (action["type"] === "addRecord" && isColl(coll)) {
    const record = RECORDS[coll].safeParse(action["record"]);
    if (!record.success) return { ok: false, error: describe(record.error) };
    action["record"] = record.data;
  }
  if (action["type"] === "updateRecord" && isColl(coll)) {
    const patch = RECORDS[coll].partial().omit({ id: true }).safeParse(action["patch"]);
    if (!patch.success) return { ok: false, error: describe(patch.error) };
    action["patch"] = patch.data;
  }
  return { ok: true, action: validated<EventAction>(action) };
}

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "That change isn't valid";
  const where = issue.path.filter((p) => typeof p === "string").join(".");
  return where ? `${where}: ${issue.message}` : issue.message;
}

/** The shape a record in one collection must have. */
export const recordShape = (c: Coll) => RECORDS[c];
