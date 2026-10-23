import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer } from "react";
import { DEMO_USER, SEED_IDS, seedEvents } from "../data/seed";
import type { PlannrEvent, Profile } from "../data/types";
import { demoShift } from "../lib/dates";
import { emptyProfile, type Question, type QuestionField } from "../lib/intake";
import { applyEventAction, type EventAction, isEventAction } from "../shared/engine";

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
  version: 2;
  /** Days the demo story was moved when it was seeded; a new week reseeds it. */
  demoShift: number;
  session: Session;
  events: PlannrEvent[];
  draft: Draft;
  notificationsRead: boolean;
  toasts: Toast[];
}

export type Action =
  | EventAction
  | { type: "signIn" }
  | { type: "updateSession"; patch: Partial<Session> }
  | { type: "signOut" }
  | { type: "resetDemo" }
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
    version: 2,
    demoShift: demoShift(),
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
    return migrate(JSON.parse(raw) as SavedState);
  } catch {
    return initialState();
  }
}

/**
 * Keeps the planner's own events and draft, and reseeds the demo events when they
 * were saved by an older version or in an earlier week, so the demo never goes stale.
 */
type SavedState = Partial<Omit<AppState, "version">> & { version?: number };

export function migrate(saved: SavedState): AppState {
  const fresh = initialState();
  if ((saved.version !== 1 && saved.version !== 2) || !Array.isArray(saved.events)) return fresh;
  const state = { ...fresh, ...saved, version: 2 as const, toasts: [] };
  if (saved.version === 2 && saved.demoShift === fresh.demoShift) return state;
  const own = saved.events.filter((e) => !SEED_IDS.includes(e.id));
  return { ...state, demoShift: fresh.demoShift, events: [...fresh.events, ...own] };
}

function mapEvent(state: AppState, id: string, fn: (ev: PlannrEvent) => PlannrEvent): AppState {
  return { ...state, events: state.events.map((e) => (e.id === id ? fn(e) : e)) };
}

export function reducer(state: AppState, action: Action): AppState {
  if (isEventAction(action)) return mapEvent(state, action.eventId, (e) => applyEventAction(e, action));
  switch (action.type) {
    case "signIn":
      return { ...state, session: { ...state.session, signedIn: true } };
    case "updateSession":
      return { ...state, session: { ...state.session, ...action.patch } };
    case "signOut":
      return { ...state, session: { ...state.session, signedIn: false } };
    case "resetDemo":
      return initialState();
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
