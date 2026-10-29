import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { DEMO_USER, SEED_IDS, seedEvents } from "../data/seed";
import type { PlannrEvent, Profile } from "../data/types";
import { demoShift } from "../lib/dates";
import { initials } from "../lib/format";
import { emptyProfile, type Question, type QuestionField } from "../lib/intake";
import { applyEventAction, type EventAction, isEventAction, QUIET_ACTIONS, stamp } from "../shared/engine";
import type { AccountUser, ActivityEntry, PlanSummary, Role, SignInMethods } from "../shared/types";
import { SyncQueue } from "./sync";

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

/** Where a plan lives on the server, and what this person may do with it. */
export interface RemoteMeta {
  version: number;
  role: Role;
  side: string | null;
}

export interface Account {
  status: "unknown" | "signed-out" | "signed-in";
  user?: AccountUser;
  /** What the server offers; all false when accounts aren't switched on there. */
  methods?: SignInMethods;
}

export interface SyncStatus {
  pending: number;
  offline: boolean;
}

export interface AppState {
  version: 2;
  /** Days the demo story was moved when it was seeded; a new week reseeds it. */
  demoShift: number;
  /** "demo": everything stays in this browser. "account": plans live on the server and sync. */
  mode: "demo" | "account";
  account: Account;
  /** Server details for each plan in account mode, by event id. */
  remote: Record<string, RemoteMeta>;
  sync: SyncStatus;
  /** Plans made on this device before signing in, waiting to be saved to the account. */
  localImports: PlannrEvent[];
  session: Session;
  events: PlannrEvent[];
  draft: Draft;
  notificationsRead: boolean;
  /** Recent changes across the account's plans, for the inbox. Fetched, never saved. */
  activity: ActivityEntry[];
  /** When the inbox was last opened; newer changes by others count as unread. */
  inboxSeen: string;
  toasts: Toast[];
}

export type Action =
  | EventAction
  | { type: "signIn" }
  | { type: "updateSession"; patch: Partial<Session> }
  | { type: "signOut" }
  | { type: "resetDemo" }
  | { type: "addEvent"; event: PlannrEvent; remote?: RemoteMeta }
  | { type: "methods"; methods: SignInMethods }
  | { type: "accountStatus"; status: Account["status"] }
  | { type: "enterDemo" }
  | { type: "enterAccount"; user: AccountUser }
  | { type: "leaveAccount" }
  | { type: "setPlans"; plans: PlanSummary[]; skip?: string[] }
  | { type: "syncPlan"; plan: { event: PlannrEvent; version: number; role?: Role; side?: string | null } }
  | { type: "syncStatus"; patch: Partial<SyncStatus> }
  | { type: "dropImport"; id: string }
  | { type: "draft"; patch: Partial<Draft> }
  | { type: "draftReset"; forEvent?: string }
  | { type: "readNotifications" }
  | { type: "setActivity"; activity: ActivityEntry[] }
  | { type: "toast"; toast: Toast }
  | { type: "dismissToast"; id: string };

const STORAGE_KEY = "plannr:v1";

function freshDraft(forEvent?: string): Draft {
  return { profile: emptyProfile(), asked: [], chat: [], guidedStep: 0, generated: false, forEvent };
}

/** The parts of the session an account decides; city and language stay as the planner set them. */
export function sessionFromUser(user: AccountUser): Omit<Session, "city" | "language"> {
  const name = user.name.trim() || user.email.split("@")[0] || "Planner";
  return {
    signedIn: true,
    name,
    firstName: name.split(/\s+/)[0] ?? name,
    initials: initials(name),
    plan: user.isAnonymous ? "Guest" : "Free",
  };
}

export function initialState(): AppState {
  return {
    version: 2,
    demoShift: demoShift(),
    mode: "demo",
    account: { status: "unknown" },
    remote: {},
    sync: { pending: 0, offline: false },
    localImports: [],
    session: { signedIn: false, ...DEMO_USER },
    events: seedEvents(),
    draft: freshDraft(),
    notificationsRead: false,
    activity: [],
    inboxSeen: new Date(0).toISOString(),
    toasts: [],
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const state = migrate(JSON.parse(raw) as SavedState);
    // Sync status describes this tab's queue, which starts empty, and the session is checked
    // again on every load; until then the saved plans show as they were.
    return {
      ...state,
      sync: { pending: 0, offline: false },
      account: { ...state.account, status: "unknown" },
    };
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
  const state = { ...fresh, ...saved, version: 2 as const, toasts: [], activity: [] };
  // An account's plans come from the server, never from the demo seed.
  if (state.mode === "account") return { ...state, demoShift: fresh.demoShift };
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
      return { ...initialState(), account: state.account, session: { ...DEMO_USER, signedIn: true } };
    case "addEvent":
      return {
        ...state,
        events: [...state.events.filter((e) => e.id !== action.event.id), action.event],
        remote: action.remote ? { ...state.remote, [action.event.id]: action.remote } : state.remote,
      };
    case "methods":
      return { ...state, account: { ...state.account, methods: action.methods } };
    case "accountStatus":
      return { ...state, account: { ...state.account, status: action.status } };
    case "enterDemo":
      return {
        ...initialState(),
        draft: state.draft,
        account: { ...state.account, status: state.mode === "account" ? "signed-out" : state.account.status },
        session: { ...DEMO_USER, signedIn: true },
      };
    case "enterAccount": {
      const sameUser = state.mode === "account" && state.account.user?.id === action.user.id;
      // A guest who adds an email is the same person, so their city and language stay.
      const upgraded = state.mode === "account" && !!state.account.user?.isAnonymous;
      const own = state.mode === "demo" ? state.events.filter((e) => !SEED_IDS.includes(e.id)) : [];
      return {
        ...state,
        mode: "account",
        account: { ...state.account, status: "signed-in", user: action.user },
        session: {
          ...(sameUser || upgraded ? state.session : { city: "", language: "English" }),
          ...sessionFromUser(action.user),
        },
        events: sameUser ? state.events : [],
        remote: sameUser ? state.remote : {},
        localImports: [...state.localImports.filter((e) => !own.some((o) => o.id === e.id)), ...own],
      };
    }
    case "leaveAccount":
      return {
        ...initialState(),
        draft: state.draft,
        account: { status: "signed-out", methods: state.account.methods },
      };
    case "setPlans": {
      const skip = new Set(action.skip ?? []);
      const kept = state.events.filter((e) => skip.has(e.id));
      const fresh = action.plans.filter((p) => !skip.has(p.event.id));
      const remote: Record<string, RemoteMeta> = {};
      for (const p of action.plans) remote[p.event.id] = { version: p.version, role: p.role, side: p.side };
      return { ...state, events: [...fresh.map((p) => p.event), ...kept], remote };
    }
    case "syncPlan": {
      const { event, version } = action.plan;
      const prev = state.remote[event.id];
      const exists = state.events.some((e) => e.id === event.id);
      return {
        ...state,
        events: exists ? state.events.map((e) => (e.id === event.id ? event : e)) : [...state.events, event],
        remote: {
          ...state.remote,
          [event.id]: {
            version,
            role: action.plan.role ?? prev?.role ?? "viewer",
            side: action.plan.side !== undefined ? action.plan.side : (prev?.side ?? null),
          },
        },
      };
    }
    case "syncStatus":
      return { ...state, sync: { ...state.sync, ...action.patch } };
    case "dropImport":
      return { ...state, localImports: state.localImports.filter((e) => e.id !== action.id) };
    case "draft":
      return { ...state, draft: { ...state.draft, ...action.patch } };
    case "draftReset":
      return { ...state, draft: freshDraft(action.forEvent) };
    case "readNotifications": {
      // The server's clock, not this device's: a phone set to the wrong time still clears the inbox.
      const newest = state.activity[0]?.at;
      return {
        ...state,
        notificationsRead: true,
        inboxSeen: newest && newest > state.inboxSeen ? newest : state.inboxSeen,
      };
    }
    case "setActivity":
      return { ...state, activity: action.activity };
    case "toast":
      return { ...state, toasts: [...state.toasts.filter((t) => t.id !== action.toast.id), action.toast] };
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  sync: SyncQueue;
}

export function canEdit(role: Role | undefined): boolean {
  return role === "owner" || role === "planner";
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, raw] = useReducer(reducer, undefined, load);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sync = useMemo(() => new SyncQueue(raw), []);

  /**
   * In account mode a change to a plan applies here at once and is queued for the
   * server. Viewers can talk to the assistant on their own screen but can't change the plan.
   */
  const dispatch = useCallback(
    (action: Action) => {
      const s = stateRef.current;
      if (!isEventAction(action)) return raw(action);
      // Time-dependent parts are fixed when the change is made, in the demo too.
      const stamped = stamp(action);
      const meta = s.mode === "account" ? s.remote[action.eventId] : undefined;
      if (!meta) return raw(stamped);
      if (!canEdit(meta.role) && !QUIET_ACTIONS.has(stamped.type)) {
        raw(toast("You can view this plan but not change it. Ask the owner to make you a co-planner."));
        return;
      }
      raw(stamped);
      if (canEdit(meta.role)) sync.enqueue(stamped);
    },
    [sync],
  );

  useEffect(() => {
    const online = () => sync.flushAll();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [sync]);

  useEffect(() => {
    const { toasts: _toasts, sync: _sync, activity: _activity, ...rest } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, toasts: [], activity: [] }));
    } catch {
      // Storage full or blocked: the session still works, it just won't survive a reload.
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch, sync }), [state, dispatch, sync]);
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
