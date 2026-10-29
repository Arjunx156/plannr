import type {
  Category,
  ChangeId,
  CommunityEvent,
  LineItem,
  Message,
  PersonalEvent,
  PlannrEvent,
  Task,
} from "../data/types";
import { addDays, dayMonth, daysBetween, fridayOnOrBefore, TODAY } from "../lib/dates";
import {
  applyPlanAction,
  describePlanAction,
  PLAN_ACTION_TYPES,
  type PlanAction,
  QUIET_PLAN_ACTIONS,
  stampPlanAction,
} from "./planActions";
import { findRecord, patch as patchRecord, upsert, vendorsOf } from "./records";

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

export const EVENT_ACTION_TYPES = new Set<EventAction["type"]>([
  "toggleTask",
  "addTask",
  "updateTask",
  "resolveNotice",
  "reopenNotice",
  "pushMessage",
  "previewStatus",
  "messageActionDone",
  "applyChange",
  "addTip",
  "addLineItem",
  "updateCategory",
  "addCategory",
  "applyGuestGrowth",
  "bookPhotographer",
  "orderCake",
  "addStars",
  "addAreca",
  "approveExpense",
  "assignShift",
  "archiveEvent",
  "renameEvent",
  "replacePlan",
  ...PLAN_ACTION_TYPES,
]);

const PLAN_TYPES = new Set<string>(PLAN_ACTION_TYPES);
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

export function isEventAction(a: { type: string }): a is EventAction {
  return EVENT_ACTION_TYPES.has(a.type as EventAction["type"]);
}

/** Captures anything time-dependent so replaying the action later gives the same plan. */
export function stamp(action: EventAction, today = TODAY, now = new Date().toISOString()): EventAction {
  if (action.type === "bookPhotographer" && !action.advanceDue)
    return { ...action, advanceDue: addDays(today, 14) };
  if (isPlanAction(action)) return stampPlanAction(action, today, now);
  return action;
}

/** Marks a vendor category booked in the vendor list, adding it if the list doesn't have it. */
function bookCategory(ev: PlannrEvent, category: string, name: string): PlannrEvent {
  const v = vendorsOf(ev).find((x) => x.category === category);
  if (v) return patchRecord(ev, "vendors", v.id, { stage: "booked", name: v.name || name });
  return findRecord(ev, "vendors", category.toLowerCase())
    ? ev
    : upsert(ev, "vendors", { id: category.toLowerCase(), category, name, stage: "booked", quotes: [] });
}

function withTasks<E extends PersonalEvent | CommunityEvent>(
  ev: E,
  fn: (list: Task[]) => Task[],
  added = 0,
): E {
  return { ...ev, tasks: { ...ev.tasks, total: ev.tasks.total + added, list: fn(ev.tasks.list) } };
}

function withCategory(ev: PersonalEvent, id: string, fn: (c: Category) => Category): PersonalEvent {
  return {
    ...ev,
    budget: { ...ev.budget, categories: ev.budget.categories.map((c) => (c.id === id ? fn(c) : c)) },
  };
}

function resolve<E extends PersonalEvent | CommunityEvent>(ev: E, noticeId: string, result: string): E {
  return {
    ...ev,
    notices: ev.notices.map((n) => (n.id === noticeId ? { ...n, status: "done" as const, result } : n)),
  };
}

function withThread<E extends PersonalEvent | CommunityEvent>(ev: E, fn: (t: Message[]) => Message[]): E {
  return { ...ev, assistant: { ...ev.assistant, thread: fn(ev.assistant.thread) } };
}

function applyChange(ev: PersonalEvent, change: ChangeId): PersonalEvent {
  if (change === "move-haldi") {
    const haldi = ev.functions.find((f) => f.id === "haldi");
    if (!haldi) return ev;
    const friday = fridayOnOrBefore(haldi.date);
    const shift = daysBetween(haldi.date, friday);
    const moved = withTasks(ev, (list) =>
      list.map((t) => (t.fn === "haldi" ? { ...t, due: addDays(t.due, shift) } : t)),
    );
    return {
      ...moved,
      functions: ev.functions.map((f) => (f.id === "haldi" ? { ...f, date: friday, time: "5:00 pm" } : f)),
    };
  }
  if (change === "cut-decor") {
    const cut = withCategory(ev, "decor", (c) => ({
      ...c,
      planned: 190000,
      projected: undefined,
      status: "Revised quote needed",
      tone: "due",
      items: c.items.map((i) =>
        i.id === "backdrop"
          ? { ...i, name: "Reception backdrop: draped fabric, string lights", amount: 45000 }
          : i.id === "arch"
            ? { ...i, name: "Entrance toran: marigold and mango leaf", amount: 18000 }
            : i.id === "centrepieces"
              ? { ...i, name: "Brass uruli centrepieces, reused from haldi", amount: 22000 }
              : i,
      ),
    }));
    return withTasks(
      cut,
      (list) => [
        ...list,
        {
          id: "w-urulis",
          title: "Source 30 brass urulis",
          who: "You",
          due: addDays(ev.date, -41),
          done: false,
          note: "Décor",
        },
      ],
      1,
    );
  }
  return ev;
}

function personal(ev: PlannrEvent, fn: (e: PersonalEvent) => PersonalEvent): PlannrEvent {
  return ev.layout === "personal" ? fn(ev) : ev;
}

function community(ev: PlannrEvent, fn: (e: CommunityEvent) => CommunityEvent): PlannrEvent {
  return ev.layout === "community" ? fn(ev) : ev;
}

function planned(ev: PlannrEvent, fn: <E extends PersonalEvent | CommunityEvent>(e: E) => E): PlannrEvent {
  return ev.layout === "empty" ? ev : fn(ev);
}

/** Applies one change to one event. Pure: no clock, no randomness, no side effects. */
export function applyEventAction(ev: PlannrEvent, action: EventAction): PlannrEvent {
  if (isPlanAction(action)) return applyPlanAction(ev, action);
  switch (action.type) {
    case "toggleTask":
      return planned(ev, (e) =>
        withTasks(e, (list) => list.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t))),
      );
    case "addTask":
      return planned(ev, (e) =>
        e.tasks.list.some((t) => t.id === action.task.id)
          ? e
          : withTasks(e, (list) => [...list, action.task], 1),
      );
    case "updateTask":
      return planned(ev, (e) =>
        withTasks(e, (list) => list.map((t) => (t.id === action.taskId ? { ...t, ...action.patch } : t))),
      );
    case "resolveNotice":
      return planned(ev, (e) => ({
        ...e,
        notices: e.notices.map((n) =>
          n.id === action.noticeId ? { ...n, status: action.status, result: action.result } : n,
        ),
      }));
    case "reopenNotice":
      return planned(ev, (e) => ({
        ...e,
        notices: e.notices.map((n) =>
          n.id === action.noticeId ? { ...n, status: "open" as const, result: undefined } : n,
        ),
      }));
    case "pushMessage":
      return planned(ev, (e) =>
        e.assistant.thread.some((m) => m.id === action.message.id)
          ? e
          : withThread(e, (t) => [...t, action.message]),
      );
    case "previewStatus":
      return planned(ev, (e) =>
        withThread(e, (t) =>
          t.map((m) =>
            m.id !== action.messageId
              ? m
              : m.preview
                ? { ...m, preview: { ...m.preview, status: action.status } }
                : m.proposals
                  ? { ...m, proposalStatus: action.status }
                  : m,
          ),
        ),
      );
    case "messageActionDone":
      return planned(ev, (e) =>
        withThread(e, (t) =>
          t.map((m) =>
            m.id === action.messageId && m.action ? { ...m, action: { ...m.action, done: true } } : m,
          ),
        ),
      );
    case "applyChange":
      return personal(ev, (e) => applyChange(e, action.change));
    case "addTip":
      return personal(ev, (e) =>
        withCategory(e, "gifts", (c) =>
          c.items.some((i) => i.id === "chenda-tip")
            ? c
            : {
                ...c,
                projected: (c.projected ?? c.planned) + 8000,
                items: [
                  ...c.items,
                  {
                    id: "chenda-tip",
                    name: "Tip for the chenda melam troupe",
                    vendor: "Sree Durga Chenda Sangham",
                    amount: 8000,
                    estimate: true,
                    status: "unpaid",
                    due: e.date,
                  },
                ],
              },
        ),
      );
    case "addLineItem":
      return personal(ev, (e) =>
        withCategory(e, action.categoryId, (c) => ({
          ...c,
          spent: c.spent + action.spent,
          items: [...c.items, action.item],
        })),
      );
    case "updateCategory":
      return personal(ev, (e) => withCategory(e, action.categoryId, (c) => ({ ...c, ...action.patch })));
    case "addCategory":
      return personal(ev, (e) => ({
        ...e,
        budget: { ...e.budget, categories: [...e.budget.categories, action.category] },
      }));
    case "applyGuestGrowth":
      return personal(ev, (e) => {
        const grown = withCategory(
          withCategory(e, "catering", (c) => ({ ...c, projected: (c.projected ?? c.planned) + 36288 })),
          "invitations",
          (c) => ({ ...c, projected: (c.projected ?? c.planned) + 2700 }),
        );
        return resolve(grown, "guests-grew", "Applied: catering, invitations and seating now plan for 268.");
      });
    case "bookPhotographer":
      return personal(ev, (e) => {
        const booked: PersonalEvent = {
          ...e,
          vendors: {
            ...e.vendors,
            booked: e.vendors.booked.includes("Photography")
              ? e.vendors.booked
              : [...e.vendors.booked, "Photography"],
            talking: e.vendors.talking.filter((v) => v !== "Photography"),
            note: undefined,
          },
        };
        const withPhoto = withCategory(booked, "photo", (c) => ({
          ...c,
          status: `Booked · advance due ${dayMonth(action.advanceDue ?? addDays(TODAY, 14))}`,
          tone: "due",
          projected: action.price,
          items: c.items.map((i) =>
            i.id === "photo-pkg" ? { ...i, vendor: action.studio, amount: action.price, estimate: false } : i,
          ),
        }));
        const done = withTasks(withPhoto, (list) =>
          list.map((t) => (t.id === "w4" ? { ...t, done: true } : t)),
        );
        const listed = bookCategory(done, "Photography", action.studio) as PersonalEvent;
        return resolve(listed, "photographer-window", `Booked ${action.studio}.`);
      });
    case "orderCake":
      return personal(ev, (e) => {
        const ordered = withTasks(
          {
            ...e,
            vendors: {
              ...e.vendors,
              booked: e.vendors.booked.includes("Cake") ? e.vendors.booked : [...e.vendors.booked, "Cake"],
              talking: e.vendors.talking.filter((v) => v !== "Cake"),
            },
          },
          (list) => list.map((t) => (t.id === "b1" ? { ...t, done: true } : t)),
        );
        const listed = bookCategory(ordered, "Cake", "Bake Street") as PersonalEvent;
        return resolve(
          {
            ...listed,
            home: { ...ordered.home, readinessNote: { text: "Snacks caterer not chosen", tone: "idle" } },
          },
          "cake-order",
          "Cake ordered from Bake Street.",
        );
      });
    case "addStars":
      return personal(ev, (e) => {
        if (e.tasks.list.some((t) => t.id === "b-stars")) return e;
        const swapped = withCategory(e, "decor", (c) => ({
          ...c,
          planned: c.planned - 1800,
          items: c.items.filter((i) => i.id !== "arch2"),
        }));
        const tasked = withTasks(
          swapped,
          (list) => [
            ...list,
            {
              id: "b-stars",
              title: "Stick glow-in-the-dark stars on the ceiling",
              who: "Vivek",
              due: addDays(e.date, -1),
              done: false,
              note: "Décor",
            },
          ],
          1,
        );
        return resolve(tasked, "stars", "Added: stars instead of the second arch. ₹1,800 freed up.");
      });
    case "addAreca":
      return community(ev, (e) => {
        if (e.tasks.list.some((t) => t.id === "m-areca-1")) return e;
        const tasked = withTasks(
          e,
          (list) => [
            ...list,
            {
              id: "m-areca-1",
              title: "Tell food stalls about areca-leaf plates",
              who: "Rekha",
              due: addDays(e.date, -28),
              done: false,
            },
            {
              id: "m-areca-2",
              title: "Order 3,000 areca plates for the stalls",
              who: "Thomas",
              due: addDays(e.date, -14),
              done: false,
            },
          ],
          2,
        );
        return resolve(tasked, "areca", "Added 2 tasks for Rekha and Thomas.");
      });
    case "approveExpense":
      return community(ev, (e) => {
        const approval = e.funds.approvals.find((a) => a.id === action.approvalId);
        if (approval?.status !== "pending") return e;
        const spent = action.status === "approved" ? approval.amount : 0;
        return {
          ...e,
          funds: {
            ...e.funds,
            spent: e.funds.spent + spent,
            approvals: e.funds.approvals.map((a) =>
              a.id === action.approvalId ? { ...a, status: action.status } : a,
            ),
          },
          permits:
            action.approvalId === "a1" && action.status === "approved"
              ? e.permits.map((p) =>
                  p.label.startsWith("Sound & lighting")
                    ? { ...p, status: "Booked", tone: "ok" as const }
                    : p,
                )
              : e.permits,
        };
      });
    case "assignShift":
      return community(ev, (e) => ({
        ...e,
        volunteers: e.volunteers.includes(action.name) ? e.volunteers : [...e.volunteers, action.name],
        shifts: {
          ...e.shifts,
          roles: e.shifts.roles.map((r) =>
            r.role === action.role
              ? {
                  ...r,
                  slots: r.slots.map((s, i) =>
                    i === action.slot && !s.names.includes(action.name)
                      ? { need: Math.max(s.need, s.names.length + 1), names: [...s.names, action.name] }
                      : s,
                  ),
                }
              : r,
          ),
        },
      }));
    case "archiveEvent":
      return { ...ev, archived: action.archived };
    case "renameEvent":
      return { ...ev, name: action.name.trim().slice(0, 120) || ev.name };
    case "replacePlan":
      // The id and archive state belong to the event, not the draft.
      return { ...action.event, id: ev.id, archived: ev.archived } as PlannrEvent;
  }
}

/** Folds a list of actions over a starting plan. */
export function replay(base: PlannrEvent, actions: EventAction[]): PlannrEvent {
  return actions.reduce(applyEventAction, base);
}

const quote = (s: string) => `“${s}”`;

/** One line for the history panel: what changed, in words a co-planner recognises. */
export function describeAction(action: EventAction, ev: PlannrEvent): string {
  if (isPlanAction(action)) return describePlanAction(action, ev);
  const task = (id: string) =>
    ev.layout === "empty" ? undefined : ev.tasks.list.find((t) => t.id === id)?.title;
  const notice = (id: string) =>
    ev.layout === "empty" ? undefined : ev.notices.find((n) => n.id === id)?.label;
  switch (action.type) {
    case "toggleTask": {
      const t = ev.layout === "empty" ? undefined : ev.tasks.list.find((x) => x.id === action.taskId);
      // Described before it applies: a task that isn't done yet is being ticked off.
      return t ? `${t.done ? "Reopened" : "Ticked off"} ${quote(t.title)}` : "Changed a task";
    }
    case "addTask":
      return `Added the task ${quote(action.task.title)}`;
    case "updateTask":
      return `Edited ${quote(task(action.taskId) ?? "a task")}`;
    case "resolveNotice":
      return action.status === "dismissed"
        ? `Dismissed ${quote(notice(action.noticeId) ?? "a suggestion")}`
        : (action.result ?? `Handled ${quote(notice(action.noticeId) ?? "a suggestion")}`);
    case "reopenNotice":
      return `Reopened ${quote(notice(action.noticeId) ?? "a suggestion")}`;
    case "applyChange":
      return action.change === "move-haldi"
        ? "Moved the haldi to Friday and its tasks with it"
        : action.change === "cut-decor"
          ? "Cut ₹50,000 from décor, keeping the mandapam"
          : "Applied a suggested change";
    case "addTip":
      return "Added ₹8,000 for the chenda melam tip";
    case "addLineItem":
      return `Added ${quote(action.item.name)} to the budget`;
    case "updateCategory":
      return "Updated a budget category";
    case "addCategory":
      return `Added the budget category ${quote(action.category.name)}`;
    case "applyGuestGrowth":
      return "Updated catering, invitations and seating for the new headcount";
    case "bookPhotographer":
      return `Booked ${action.studio} for photography`;
    case "orderCake":
      return "Marked the cake as ordered";
    case "addStars":
      return "Swapped the second balloon arch for glow-in-the-dark stars";
    case "addAreca":
      return "Added the areca-leaf plate tasks";
    case "approveExpense":
      return `${action.status === "approved" ? "Approved" : "Declined"} an expense`;
    case "assignShift":
      return `Put ${action.name} on ${action.role}`;
    case "archiveEvent":
      return action.archived ? "Archived the event" : "Restored the event";
    case "renameEvent":
      return `Renamed the event to ${quote(action.name)}`;
    case "replacePlan":
      return ev.layout === "empty" ? "Drafted the plan" : "Replaced the plan with a new draft";
    case "pushMessage":
    case "previewStatus":
    case "messageActionDone":
      return "Talked to the assistant";
  }
}
