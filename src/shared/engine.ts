import type {
  Category,
  ChangeId,
  CommunityEvent,
  LineItem,
  Message,
  Notice,
  PlannrEvent,
  Slot,
  Task,
} from "../data/types";
import { addDays, TODAY } from "../lib/dates";
import {
  addTasks,
  eventName,
  onCommunity,
  onPersonal,
  onPlanned,
  type PlannedEvent,
  withCategory,
  withTasks,
  withThread,
} from "./eventEdits";
import {
  applyPlanAction,
  describePlanAction,
  PLAN_ACTION_TYPES,
  type PlanAction,
  QUIET_PLAN_ACTIONS,
  stampPlanAction,
} from "./planActions";
import {
  ADVANCE_DUE_DAYS,
  addAreca,
  addChendaTip,
  addStars,
  applyGuestGrowth,
  applySuggestedChange,
  bookPhotographer,
  orderCake,
} from "./suggestions";

/**
 * The plan engine. Every change to an event is a typed action, applied by one pure
 * function that runs in the browser (instantly) and on the server (the record of
 * truth, with history). Undo replays the remaining history from the event's start,
 * so an action must give the same result every time it is applied: anything that
 * depends on "now" is captured in the action when it is created.
 */
export type EventAction =
  | { type: "toggleTask"; eventId: string; taskId: string }
  | { type: "addTask"; eventId: string; task: Task }
  | { type: "updateTask"; eventId: string; taskId: string; patch: Partial<Omit<Task, "id">> }
  | {
      type: "resolveNotice";
      eventId: string;
      noticeId: string;
      status: "done" | "dismissed";
      result?: string;
    }
  | { type: "reopenNotice"; eventId: string; noticeId: string }
  | { type: "pushMessage"; eventId: string; message: Message }
  | { type: "previewStatus"; eventId: string; messageId: string; status: "applied" | "rejected" }
  | { type: "messageActionDone"; eventId: string; messageId: string }
  | { type: "applyChange"; eventId: string; change: ChangeId }
  | { type: "addTip"; eventId: string }
  | { type: "addLineItem"; eventId: string; categoryId: string; item: LineItem; spent: number }
  | { type: "updateCategory"; eventId: string; categoryId: string; patch: Partial<Category> }
  | { type: "addCategory"; eventId: string; category: Category }
  | { type: "applyGuestGrowth"; eventId: string }
  | { type: "bookPhotographer"; eventId: string; studio: string; price: number; advanceDue?: string }
  | { type: "orderCake"; eventId: string }
  | { type: "addStars"; eventId: string }
  | { type: "addAreca"; eventId: string }
  | { type: "approveExpense"; eventId: string; approvalId: string; status: "approved" | "declined" }
  | { type: "assignShift"; eventId: string; role: string; slot: number; name: string }
  | { type: "archiveEvent"; eventId: string; archived: boolean }
  | { type: "renameEvent"; eventId: string; name: string }
  /** Puts a freshly drafted plan in place of an event that had none, or an earlier draft. */
  | { type: "replacePlan"; eventId: string; event: PlannrEvent }
  | PlanAction;

/** Actions handled in this file; the plan's record actions are handled in planActions.ts. */
type CoreAction = Exclude<EventAction, PlanAction>;
type ActionOf<T extends CoreAction["type"]> = Extract<CoreAction, { type: T }>;

/** One entry per action type: the mapped type makes the compiler insist on every one. */
type ByAction<R> = { [T in CoreAction["type"]]: (ev: PlannrEvent, action: ActionOf<T>) => R };

// ---------------------------------------------------------------- reducers

/** Rewrites one task. */
function mapTask<E extends PlannedEvent>(ev: E, taskId: string, fn: (t: Task) => Task): E {
  return withTasks(ev, (list) => list.map((t) => (t.id === taskId ? fn(t) : t)));
}

/** Sets one notice's status, with the line that says what came of it. */
function setNotice<E extends PlannedEvent>(
  ev: E,
  noticeId: string,
  status: Notice["status"],
  result?: string,
): E {
  return { ...ev, notices: ev.notices.map((n) => (n.id === noticeId ? { ...n, status, result } : n)) };
}

/** Rewrites one message in the assistant thread. */
function mapMessage<E extends PlannedEvent>(ev: E, messageId: string, fn: (m: Message) => Message): E {
  return withThread(ev, (t) => t.map((m) => (m.id === messageId ? fn(m) : m)));
}

/** Records the planner's answer to a message's preview, or else to its proposals. */
function answerMessage(m: Message, status: "applied" | "rejected"): Message {
  if (m.preview) return { ...m, preview: { ...m.preview, status } };
  if (m.proposals) return { ...m, proposalStatus: status };
  return m;
}

/** Adds a message once: a message that arrives on two devices appears once. */
function pushMessage<E extends PlannedEvent>(ev: E, message: Message): E {
  return ev.assistant.thread.some((m) => m.id === message.id) ? ev : withThread(ev, (t) => [...t, message]);
}

/** Approving an expense can settle the permit that waited on it: the mela's sound and lighting. */
const PERMIT_FOR_APPROVAL: Record<string, string> = { a1: "Sound & lighting" };

/** Approves or declines a pending committee expense; approved money counts as spent. */
function decideExpense(
  ev: CommunityEvent,
  approvalId: string,
  status: "approved" | "declined",
): CommunityEvent {
  const approval = ev.funds.approvals.find((a) => a.id === approvalId);
  if (approval?.status !== "pending") return ev;
  const approved = status === "approved";
  const funds = {
    ...ev.funds,
    spent: ev.funds.spent + (approved ? approval.amount : 0),
    approvals: ev.funds.approvals.map((a) => (a.id === approvalId ? { ...a, status } : a)),
  };
  const permit = approved ? PERMIT_FOR_APPROVAL[approvalId] : undefined;
  const permits = permit
    ? ev.permits.map((p) =>
        p.label.startsWith(permit) ? { ...p, status: "Booked", tone: "ok" as const } : p,
      )
    : ev.permits;
  return { ...ev, funds, permits };
}

/** Puts a volunteer on a slot, widening the slot when it was already full. */
function fillSlot(slot: Slot, name: string): Slot {
  if (slot.names.includes(name)) return slot;
  return { need: Math.max(slot.need, slot.names.length + 1), names: [...slot.names, name] };
}

/** Puts a volunteer on one role's slot, adding them to the volunteer list if they're new. */
function assignShift(ev: CommunityEvent, { role, slot, name }: ActionOf<"assignShift">): CommunityEvent {
  const roles = ev.shifts.roles.map((r) =>
    r.role === role ? { ...r, slots: r.slots.map((s, i) => (i === slot ? fillSlot(s, name) : s)) } : r,
  );
  const volunteers = ev.volunteers.includes(name) ? ev.volunteers : [...ev.volunteers, name];
  return { ...ev, volunteers, shifts: { ...ev.shifts, roles } };
}

/** Adds to a budget category's spend and its line items. */
function addLineItem(ev: PlannrEvent, { categoryId, item, spent }: ActionOf<"addLineItem">): PlannrEvent {
  return onPersonal(ev, (e) =>
    withCategory(e, categoryId, (c) => ({ ...c, spent: c.spent + spent, items: [...c.items, item] })),
  );
}

/** Adds a budget category. */
function addCategory(ev: PlannrEvent, category: Category): PlannrEvent {
  return onPersonal(ev, (e) => ({
    ...e,
    budget: { ...e.budget, categories: [...e.budget.categories, category] },
  }));
}

const REDUCERS: ByAction<PlannrEvent> = {
  toggleTask: (ev, a) => onPlanned(ev, (e) => mapTask(e, a.taskId, (t) => ({ ...t, done: !t.done }))),
  addTask: (ev, a) => onPlanned(ev, (e) => addTasks(e, [a.task])),
  updateTask: (ev, a) => onPlanned(ev, (e) => mapTask(e, a.taskId, (t) => ({ ...t, ...a.patch }))),
  resolveNotice: (ev, a) => onPlanned(ev, (e) => setNotice(e, a.noticeId, a.status, a.result)),
  reopenNotice: (ev, a) => onPlanned(ev, (e) => setNotice(e, a.noticeId, "open")),
  pushMessage: (ev, a) => onPlanned(ev, (e) => pushMessage(e, a.message)),
  previewStatus: (ev, a) =>
    onPlanned(ev, (e) => mapMessage(e, a.messageId, (m) => answerMessage(m, a.status))),
  messageActionDone: (ev, a) =>
    onPlanned(ev, (e) =>
      mapMessage(e, a.messageId, (m) => (m.action ? { ...m, action: { ...m.action, done: true } } : m)),
    ),
  applyChange: (ev, a) => onPersonal(ev, (e) => applySuggestedChange(e, a.change)),
  addTip: (ev) => onPersonal(ev, addChendaTip),
  addLineItem,
  updateCategory: (ev, a) =>
    onPersonal(ev, (e) => withCategory(e, a.categoryId, (c) => ({ ...c, ...a.patch }))),
  addCategory: (ev, a) => addCategory(ev, a.category),
  applyGuestGrowth: (ev) => onPersonal(ev, applyGuestGrowth),
  bookPhotographer: (ev, a) => onPersonal(ev, (e) => bookPhotographer(e, a)),
  orderCake: (ev) => onPersonal(ev, orderCake),
  addStars: (ev) => onPersonal(ev, addStars),
  addAreca: (ev) => onCommunity(ev, addAreca),
  approveExpense: (ev, a) => onCommunity(ev, (e) => decideExpense(e, a.approvalId, a.status)),
  assignShift: (ev, a) => onCommunity(ev, (e) => assignShift(e, a)),
  archiveEvent: (ev, a) => ({ ...ev, archived: a.archived }),
  renameEvent: (ev, a) => ({ ...ev, name: eventName(a.name, ev.name) }),
  // The id and archive state belong to the event, not the draft.
  replacePlan: (ev, a) => ({ ...a.event, id: ev.id, archived: ev.archived }) as PlannrEvent,
};

/** Every action type Plannr accepts; the server refuses anything else. */
export const EVENT_ACTION_TYPES = new Set<EventAction["type"]>([
  ...(Object.keys(REDUCERS) as CoreAction["type"][]),
  ...PLAN_ACTION_TYPES,
]);

const PLAN_TYPES = new Set<string>(PLAN_ACTION_TYPES);

/** Whether an action changes the plan's records (handled in planActions.ts). */
export function isPlanAction(a: EventAction): a is PlanAction {
  return PLAN_TYPES.has(a.type);
}

/** Conversation with the assistant: saved with the plan, but not part of its history. */
export const QUIET_ACTIONS = new Set<EventAction["type"]>([
  "pushMessage",
  "previewStatus",
  "messageActionDone",
  ...QUIET_PLAN_ACTIONS,
]);

/** Whether an object's `type` names a known action; the server also validates its fields. */
export function isEventAction(a: { type: string }): a is EventAction {
  return EVENT_ACTION_TYPES.has(a.type as EventAction["type"]);
}

/** Captures anything time-dependent so replaying the action later gives the same plan. */
export function stamp(action: EventAction, today = TODAY, now = new Date().toISOString()): EventAction {
  if (action.type === "bookPhotographer" && !action.advanceDue)
    return { ...action, advanceDue: addDays(today, ADVANCE_DUE_DAYS) };
  if (isPlanAction(action)) return stampPlanAction(action, today, now);
  return action;
}

/** Applies one change to one event. Pure: no clock, no randomness, no side effects. */
export function applyEventAction(ev: PlannrEvent, action: EventAction): PlannrEvent {
  if (isPlanAction(action)) return applyPlanAction(ev, action);
  // TypeScript can't correlate the table's key with its handler's argument; the table's type does.
  const reduce = REDUCERS[action.type] as (ev: PlannrEvent, action: CoreAction) => PlannrEvent;
  return reduce(ev, action);
}

/** Folds a list of actions over a starting plan. */
export function replay(base: PlannrEvent, actions: EventAction[]): PlannrEvent {
  return actions.reduce(applyEventAction, base);
}

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
