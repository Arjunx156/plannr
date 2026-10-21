import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer } from "react";
import { DEMO_USER, seedEvents } from "../data/seed";
import type {
  Category,
  ChangeId,
  CommunityEvent,
  LineItem,
  Message,
  PersonalEvent,
  PlannrEvent,
  Profile,
  Task,
} from "../data/types";
import { addDays } from "../lib/dates";
import { emptyProfile, type Question, type QuestionField } from "../lib/intake";

export interface Session {
  signedIn: boolean;
  name: string;
  firstName: string;
  initials: string;
  city: string;
  language: string;
  plan: string;
}

export interface ChatTurn {
  id: string;
  role: "user" | "ai";
  text: string;
  question?: Question;
}

export interface Draft {
  profile: Profile;
  asked: QuestionField[];
  chat: ChatTurn[];
  guidedStep: number;
  /** Set once the plan is generated, so the summary can be revisited. */
  generated: boolean;
  /** The event the draft becomes when accepted, if it fills in an existing one. */
  forEvent?: string;
}

export interface Toast {
  id: string;
  text: string;
  undo?: Action;
}

export interface AppState {
  version: 1;
  session: Session;
  events: PlannrEvent[];
  draft: Draft;
  notificationsRead: boolean;
  toasts: Toast[];
}

export type Action =
  | { type: "signIn" }
  | { type: "updateSession"; patch: Partial<Session> }
  | { type: "signOut" }
  | { type: "resetDemo" }
  | { type: "toggleTask"; eventId: string; taskId: string }
  | { type: "addTask"; eventId: string; task: Task }
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
  | { type: "bookPhotographer"; eventId: string; studio: string; price: number }
  | { type: "orderCake"; eventId: string }
  | { type: "addStars"; eventId: string }
  | { type: "addAreca"; eventId: string }
  | { type: "approveExpense"; eventId: string; approvalId: string; status: "approved" | "declined" }
  | { type: "assignShift"; eventId: string; role: string; slot: number; name: string }
  | { type: "archiveEvent"; eventId: string; archived: boolean }
  | { type: "addEvent"; event: PlannrEvent }
  | { type: "draft"; patch: Partial<Draft> }
  | { type: "draftReset"; forEvent?: string }
  | { type: "readNotifications" }
  | { type: "toast"; toast: Toast }
  | { type: "dismissToast"; id: string };

const STORAGE_KEY = "plannr:v1";

function freshDraft(forEvent?: string): Draft {
  return { profile: emptyProfile(), asked: [], chat: [], guidedStep: 0, generated: false, forEvent };
}

export function initialState(): AppState {
  return {
    version: 1,
    session: { signedIn: false, ...DEMO_USER },
    events: seedEvents(),
    draft: freshDraft(),
    notificationsRead: false,
    toasts: [],
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw) as AppState;
    if (saved.version !== 1 || !Array.isArray(saved.events)) return initialState();
    return { ...saved, toasts: [] };
  } catch {
    return initialState();
  }
}

type EventFn<E> = (ev: E) => E;

function mapEvent(state: AppState, id: string, fn: EventFn<PlannrEvent>): AppState {
  return { ...state, events: state.events.map((e) => (e.id === id ? fn(e) : e)) };
}

function mapPersonal(state: AppState, id: string, fn: EventFn<PersonalEvent>): AppState {
  return mapEvent(state, id, (e) => (e.layout === "personal" ? fn(e) : e));
}

function mapCommunity(state: AppState, id: string, fn: EventFn<CommunityEvent>): AppState {
  return mapEvent(state, id, (e) => (e.layout === "community" ? fn(e) : e));
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
    const moved = withTasks(ev, (list) =>
      list.map((t) => (t.fn === "haldi" ? { ...t, due: addDays(t.due, -1) } : t)),
    );
    return {
      ...moved,
      functions: ev.functions.map((f) =>
        f.id === "haldi" ? { ...f, date: "2027-04-23", time: "5:00 pm" } : f,
      ),
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
          due: "2027-03-15",
          done: false,
          note: "Décor",
        },
      ],
      1,
    );
  }
  return ev;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "signIn":
      return { ...state, session: { ...state.session, signedIn: true } };
    case "updateSession":
      return { ...state, session: { ...state.session, ...action.patch } };
    case "signOut":
      return { ...state, session: { ...state.session, signedIn: false } };
    case "resetDemo":
      return initialState();
    case "toggleTask":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty"
          ? e
          : withTasks(e, (list) => list.map((t) => (t.id === action.taskId ? { ...t, done: !t.done } : t))),
      );
    case "addTask":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty" ? e : withTasks(e, (list) => [...list, action.task], 1),
      );
    case "resolveNotice":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty"
          ? e
          : {
              ...e,
              notices: e.notices.map((n) =>
                n.id === action.noticeId ? { ...n, status: action.status, result: action.result } : n,
              ),
            },
      );
    case "reopenNotice":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty"
          ? e
          : {
              ...e,
              notices: e.notices.map((n) =>
                n.id === action.noticeId ? { ...n, status: "open" as const, result: undefined } : n,
              ),
            },
      );
    case "pushMessage":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty" ? e : withThread(e, (t) => [...t, action.message]),
      );
    case "previewStatus":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty"
          ? e
          : withThread(e, (t) =>
              t.map((m) =>
                m.id === action.messageId && m.preview
                  ? { ...m, preview: { ...m.preview, status: action.status } }
                  : m,
              ),
            ),
      );
    case "messageActionDone":
      return mapEvent(state, action.eventId, (e) =>
        e.layout === "empty"
          ? e
          : withThread(e, (t) =>
              t.map((m) =>
                m.id === action.messageId && m.action ? { ...m, action: { ...m.action, done: true } } : m,
              ),
            ),
      );
    case "applyChange":
      return mapPersonal(state, action.eventId, (e) => applyChange(e, action.change));
    case "addTip":
      return mapPersonal(state, action.eventId, (e) =>
        withCategory(e, "gifts", (c) => ({
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
              due: "2027-04-25",
            },
          ],
        })),
      );
    case "addLineItem":
      return mapPersonal(state, action.eventId, (e) =>
        withCategory(e, action.categoryId, (c) => ({
          ...c,
          spent: c.spent + action.spent,
          items: [...c.items, action.item],
        })),
      );
    case "updateCategory":
      return mapPersonal(state, action.eventId, (e) =>
        withCategory(e, action.categoryId, (c) => ({ ...c, ...action.patch })),
      );
    case "addCategory":
      return mapPersonal(state, action.eventId, (e) => ({
        ...e,
        budget: { ...e.budget, categories: [...e.budget.categories, action.category] },
      }));
    case "applyGuestGrowth":
      return mapPersonal(state, action.eventId, (e) => {
        const grown = withCategory(
          withCategory(e, "catering", (c) => ({ ...c, projected: (c.projected ?? c.planned) + 36288 })),
          "invitations",
          (c) => ({ ...c, projected: (c.projected ?? c.planned) + 2700 }),
        );
        return resolve(grown, "guests-grew", "Applied: catering, invitations and seating now plan for 268.");
      });
    case "bookPhotographer":
      return mapPersonal(state, action.eventId, (e) => {
        const booked: PersonalEvent = {
          ...e,
          vendors: {
            ...e.vendors,
            booked: [...e.vendors.booked, "Photography"],
            talking: e.vendors.talking.filter((v) => v !== "Photography"),
            note: undefined,
          },
        };
        const withPhoto = withCategory(booked, "photo", (c) => ({
          ...c,
          status: "Booked · advance due 11 Oct",
          tone: "due",
          projected: action.price,
          items: c.items.map((i) =>
            i.id === "photo-pkg" ? { ...i, vendor: action.studio, amount: action.price, estimate: false } : i,
          ),
        }));
        const done = withTasks(withPhoto, (list) =>
          list.map((t) => (t.id === "w4" ? { ...t, done: true } : t)),
        );
        return resolve(done, "photographer-window", `Booked ${action.studio}.`);
      });
    case "orderCake":
      return mapPersonal(state, action.eventId, (e) => {
        const ordered = withTasks(
          {
            ...e,
            vendors: {
              ...e.vendors,
              booked: [...e.vendors.booked, "Cake"],
              talking: e.vendors.talking.filter((v) => v !== "Cake"),
            },
          },
          (list) => list.map((t) => (t.id === "b1" ? { ...t, done: true } : t)),
        );
        return resolve(
          {
            ...ordered,
            home: { ...ordered.home, readinessNote: { text: "Snacks caterer not chosen", tone: "idle" } },
          },
          "cake-order",
          "Cake ordered from Bake Street.",
        );
      });
    case "addStars":
      return mapPersonal(state, action.eventId, (e) => {
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
              due: "2026-10-16",
              done: false,
              note: "Décor",
            },
          ],
          1,
        );
        return resolve(tasked, "stars", "Added: stars instead of the second arch. ₹1,800 freed up.");
      });
    case "addAreca":
      return mapCommunity(state, action.eventId, (e) => {
        const tasked = withTasks(
          e,
          (list) => [
            ...list,
            {
              id: "m-areca-1",
              title: "Tell food stalls about areca-leaf plates",
              who: "Rekha",
              due: "2026-10-10",
              done: false,
            },
            {
              id: "m-areca-2",
              title: "Order 3,000 areca plates for the stalls",
              who: "Thomas",
              due: "2026-10-24",
              done: false,
            },
          ],
          2,
        );
        return resolve(tasked, "areca", "Added 2 tasks for Rekha and Thomas.");
      });
    case "approveExpense":
      return mapCommunity(state, action.eventId, (e) => {
        const approval = e.funds.approvals.find((a) => a.id === action.approvalId);
        const spent = approval && action.status === "approved" ? approval.amount : 0;
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
      return mapCommunity(state, action.eventId, (e) => ({
        ...e,
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
      return mapEvent(state, action.eventId, (e) => ({ ...e, archived: action.archived }));
    case "addEvent":
      return { ...state, events: [...state.events.filter((e) => e.id !== action.event.id), action.event] };
    case "draft":
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case "draftReset":
      return { ...state, draft: freshDraft(action.forEvent) };
    case "readNotifications":
      return { ...state, notificationsRead: true };
    case "toast":
      return { ...state, toasts: [...state.toasts.filter((t) => t.id !== action.toast.id), action.toast] };
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    const { toasts: _toasts, ...rest } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, toasts: [] }));
    } catch {
      // Storage full or blocked: the session still works, it just won't survive a reload.
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export function useEventById(id: string | undefined): PlannrEvent | undefined {
  const { state } = useStore();
  return state.events.find((e) => e.id === id);
}

let toastSeq = 0;
export function toast(text: string, undo?: Action): Action {
  toastSeq += 1;
  return { type: "toast", toast: { id: `t${toastSeq}`, text, undo } };
}
