import type { AiProposal } from "../data/messageTypes";
import type { PlannrEvent } from "../data/types";
import { addDays } from "../lib/dates";
import { describeAction } from "./describeAction";
import type { EventAction } from "./engine";
import { functionsOf } from "./eventLists";
import { findRecord } from "./records";
import { genericRipple, headcountRipple, moveFunctionRipple, type Ripple } from "./ripple";

/**
 * The assistant proposes changes in a small vocabulary; this turns each into plan changes,
 * checked against the plan as it is now. A proposal that names a task, function or budget
 * line the plan doesn't have is dropped, never guessed at.
 */

let seq = 0;
const id = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

type Planned = Exclude<PlannrEvent, { layout: "empty" }>;
type Translate = (ev: Planned, p: AiProposal, today: string) => EventAction[];

/** Days ahead a new task falls due when the assistant doesn't say. */
const DEFAULT_TASK_DAYS = 7;

/** The proposed due date if it's before the event; otherwise a week out, never after the event. */
function taskDue(ev: Planned, due: string | undefined, today: string): string {
  if (due && due <= ev.date) return due;
  const soon = addDays(today, DEFAULT_TASK_DAYS);
  return soon < ev.date ? soon : ev.date;
}

/** The function id, but only if the plan has that function. */
function knownFunction(ev: Planned, fnId: string | undefined): { fnId: string } | undefined {
  return fnId && functionsOf(ev).some((f) => f.id === fnId) ? { fnId } : undefined;
}

const TRANSLATE: Record<AiProposal["kind"], Translate> = {
  addTask: (ev, p, today) => {
    if (!p.title) return [];
    const fn = knownFunction(ev, p.fnId);
    const task = {
      id: id("ai"),
      title: p.title,
      who: p.who ?? "You",
      due: taskDue(ev, p.due, today),
      done: false,
      ...(fn ? { fn: fn.fnId } : {}),
    };
    return [{ type: "addTask", eventId: ev.id, task }];
  },
  moveTask: (ev, p) => {
    const t = ev.tasks.list.find((x) => x.id === p.taskId);
    if (!t || !p.due || p.due === t.due) return [];
    return [{ type: "updateTask", eventId: ev.id, taskId: t.id, patch: { due: p.due } }];
  },
  completeTask: (ev, p) => {
    const t = ev.tasks.list.find((x) => x.id === p.taskId);
    return t && !t.done ? [{ type: "toggleTask", eventId: ev.id, taskId: t.id }] : [];
  },
  setHeadcount: (ev, p) =>
    ev.layout === "personal" && p.guests && p.guests !== ev.guests
      ? [{ type: "setHeadcount", eventId: ev.id, guests: p.guests }]
      : [],
  setBudgetLine: (ev, p) => {
    const c = p.categoryId ? findRecord(ev, "categories", p.categoryId) : undefined;
    if (!c || p.amount === undefined || p.amount === c.planned) return [];
    return [
      { type: "updateRecord", eventId: ev.id, coll: "categories", id: c.id, patch: { planned: p.amount } },
    ];
  },
  remember: (ev, p) =>
    p.text
      ? [{ type: "addRecord", eventId: ev.id, coll: "memory", record: { id: id("mem"), text: p.text } }]
      : [],
  announce: (ev, p) => {
    if (!p.text) return [];
    const record = { id: id("an"), at: "", text: p.text };
    return [{ type: "addRecord", eventId: ev.id, coll: "announcements", record }];
  },
  moveFunction: (ev, p) => {
    const f = functionsOf(ev).find((x) => x.id === p.fnId);
    if (!f || !p.date || p.date === f.date) return [];
    return [{ type: "updateRecord", eventId: ev.id, coll: "functions", id: f.id, patch: { date: p.date } }];
  },
  addChecklist: (ev, p) => {
    if (!p.label) return [];
    const record = { id: id("ck"), label: p.label, done: false, ...knownFunction(ev, p.fnId) };
    return [{ type: "addRecord", eventId: ev.id, coll: "checklist", record }];
  },
};

/** The plan changes one proposal stands for; none when it names something the plan doesn't have. */
export function proposalActions(ev: PlannrEvent, p: AiProposal, today: string): EventAction[] {
  if (ev.layout === "empty") return [];
  // Proposals arrive from the model: an unknown kind is dropped, never guessed at.
  return TRANSLATE[p.kind]?.(ev, p, today) ?? [];
}

/** The preview for what the assistant proposed, with every connected change. */
export function proposalRipple(ev: PlannrEvent, proposals: AiProposal[], today: string): Ripple | undefined {
  const [only] = proposals;
  if (proposals.length === 1 && only) {
    // The richer previews: a headcount moves catering and favours; a function moves its tasks.
    if (only.kind === "setHeadcount" && only.guests && ev.layout === "personal" && only.guests !== ev.guests)
      return headcountRipple(ev, only.guests);
    if (only.kind === "moveFunction" && only.fnId && only.date) {
      const r = moveFunctionRipple(ev, only.fnId, only.date);
      return r.lines.length > 0 ? r : undefined;
    }
  }
  const actions = proposals.flatMap((p) => proposalActions(ev, p, today));
  if (actions.length === 0) return undefined;
  return genericRipple(
    ev,
    actions.length === 1 ? "Proposed change" : `${actions.length} proposed changes`,
    actions,
    (a) => describeAction(a, ev),
  );
}
