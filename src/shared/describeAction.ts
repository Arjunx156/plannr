import type { Task } from "../data/baseTypes";
import type { ChangeId } from "../data/messageTypes";
import type { PlannrEvent } from "../data/types";
import { describePlanAction } from "./describePlanAction";
import { type ByAction, type CoreAction, type EventAction, isPlanAction } from "./engine";

// ---------------------------------------------------------------- history lines
const quote = (s: string) => `“${s}”`;
function findTask(ev: PlannrEvent, id: string): Task | undefined {
  return ev.layout === "empty" ? undefined : ev.tasks.list.find((t) => t.id === id);
}
function noticeLabel(ev: PlannrEvent, id: string): string {
  const label = ev.layout === "empty" ? undefined : ev.notices.find((n) => n.id === id)?.label;
  return quote(label ?? "a suggestion");
}
const CHANGE_LINES: Record<ChangeId, string> = {
  "move-haldi": "Moved the haldi to Friday and its tasks with it",
  "cut-decor": "Cut ₹50,000 from décor, keeping the mandapam",
  "areca-plates": "Applied a suggested change",
};
const TALKED = () => "Talked to the assistant";
const DESCRIPTIONS: ByAction<string> = {
  toggleTask: (ev, a) => {
    const t = findTask(ev, a.taskId);
    // Described before it applies: a task that isn't done yet is being ticked off.
    return t ? `${t.done ? "Reopened" : "Ticked off"} ${quote(t.title)}` : "Changed a task";
  },
  addTask: (_, a) => `Added the task ${quote(a.task.title)}`,
  updateTask: (ev, a) => `Edited ${quote(findTask(ev, a.taskId)?.title ?? "a task")}`,
  resolveNotice: (ev, a) => {
    if (a.status === "dismissed") return `Dismissed ${noticeLabel(ev, a.noticeId)}`;
    return a.result ?? `Handled ${noticeLabel(ev, a.noticeId)}`;
  },
  reopenNotice: (ev, a) => `Reopened ${noticeLabel(ev, a.noticeId)}`,
  applyChange: (_, a) => CHANGE_LINES[a.change],
  addTip: () => "Added ₹8,000 for the chenda melam tip",
  addLineItem: (_, a) => `Added ${quote(a.item.name)} to the budget`,
  updateCategory: () => "Updated a budget category",
  addCategory: (_, a) => `Added the budget category ${quote(a.category.name)}`,
  applyGuestGrowth: () => "Updated catering, invitations and seating for the new headcount",
  bookPhotographer: (_, a) => `Booked ${a.studio} for photography`,
  orderCake: () => "Marked the cake as ordered",
  addStars: () => "Swapped the second balloon arch for glow-in-the-dark stars",
  addAreca: () => "Added the areca-leaf plate tasks",
  approveExpense: (_, a) => `${a.status === "approved" ? "Approved" : "Declined"} an expense`,
  assignShift: (_, a) => `Put ${a.name} on ${a.role}`,
  archiveEvent: (_, a) => (a.archived ? "Archived the event" : "Restored the event"),
  renameEvent: (_, a) => `Renamed the event to ${quote(a.name)}`,
  replacePlan: (ev) => (ev.layout === "empty" ? "Drafted the plan" : "Replaced the plan with a new draft"),
  pushMessage: TALKED,
  previewStatus: TALKED,
  messageActionDone: TALKED,
};

/** One line for the history panel: what changed, in words a co-planner recognises. */
export function describeAction(action: EventAction, ev: PlannrEvent): string {
  if (isPlanAction(action)) return describePlanAction(action, ev);
  const describe = DESCRIPTIONS[action.type] as (ev: PlannrEvent, action: CoreAction) => string;
  return describe(ev, action);
}
