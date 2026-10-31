import { z } from "zod";
import type { PlannrEvent } from "../src/data/types";
import type { EventAction } from "../src/shared/engine";
import { type Coll, list } from "../src/shared/records";
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
  const ev = raw as PlannrEvent;
  const tasks = (ev as { tasks?: { list?: unknown } }).tasks?.list;
  const checkedTasks = z.array(task).max(PLAN_LIMITS.items).optional().safeParse(tasks);
  if (!checkedTasks.success) return { ok: false, error: `tasks: ${describe(checkedTasks.error)}` };
  for (const c of Object.keys(RECORDS) as Coll[]) {
    const problem = recordProblem(ev, c);
    if (problem) return { ok: false, error: problem };
  }
  return { ok: true, event: ev };
}

/**
 * The one place a checked change becomes an EventAction. Every field was just validated by a
 * zod shape built from the same types, but zod's inferred union doesn't line up with the
 * EventAction union structurally, so the value is re-typed here rather than at each return.
 */
const checked = (value: unknown) => value as EventAction;

/** Checks one change; returns it cleaned, or an error message a person can read. */
export function parseAction(raw: unknown): { ok: true; action: EventAction } | { ok: false; error: string } {
  const type = (raw as { type?: unknown } | null)?.type;
  const known = typeof type === "string" && Object.hasOwn(ACTIONS, type);
  const shape = known ? ACTIONS[type as EventAction["type"]] : undefined;
  if (!shape) return { ok: false, error: "Unknown change" };
  const parsed = shape.safeParse(raw);
  if (!parsed.success) return { ok: false, error: describe(parsed.error) };
  const action = parsed.data as Record<string, unknown>;
  if (action.type === "replacePlan") {
    const plan = checkPlan(action.event);
    if (!plan.ok) return plan;
  }
  // Records are checked against their own collection's shape.
  if (action.type === "addRecord") {
    const record = RECORDS[action.coll as Coll].safeParse(action.record);
    if (!record.success) return { ok: false, error: describe(record.error) };
    action.record = record.data;
  }
  if (action.type === "updateRecord") {
    const patch = RECORDS[action.coll as Coll].partial().omit({ id: true }).safeParse(action.patch);
    if (!patch.success) return { ok: false, error: describe(patch.error) };
    action.patch = patch.data;
  }
  return { ok: true, action: checked(action) };
}

function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "That change isn't valid";
  const where = issue.path.filter((p) => typeof p === "string").join(".");
  return where ? `${where}: ${issue.message}` : issue.message;
}

export const recordShape = (c: Coll) => RECORDS[c];
