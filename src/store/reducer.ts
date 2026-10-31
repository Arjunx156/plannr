import { DEMO_USER, SEED_IDS, SEED_REVISION } from "../data/demoMeta";
import type { PlannrEvent } from "../data/types";
import { demoShift } from "../lib/dates";
import { initials } from "../lib/format";
import { emptyProfile } from "../lib/intake";
import { applyEventAction, type EventAction, isEventAction } from "../shared/engine";
import type { AccountUser } from "../shared/types";
import type { Action, AppState, Draft, RemoteMeta, Session } from "./types";

export function freshDraft(forEvent?: string): Draft {
  return { profile: emptyProfile(), asked: [], chat: [], guidedStep: 0, generated: false, forEvent };
}
/** The planner's own events in the demo: everything except the samples. */
export const ownEvents = (events: PlannrEvent[]) => events.filter((e) => !SEED_IDS.includes(e.id));

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
function mapEvent(state: AppState, id: string, fn: (ev: PlannrEvent) => PlannrEvent): AppState {
  return { ...state, events: state.events.map((e) => (e.id === id ? fn(e) : e)) };
}
type AppAction = Exclude<Action, EventAction>;
type AppActionOf<T extends AppAction["type"]> = Extract<AppAction, { type: T }>;
/** Signing in keeps a device's work: the same person keeps everything, and a guest who adds an email is the same person. */
function enterAccount(state: AppState, { user }: AppActionOf<"enterAccount">): AppState {
  const sameUser = state.mode === "account" && state.account.user?.id === user.id;
  const upgraded = state.mode === "account" && !!state.account.user?.isAnonymous;
  // Events made in the demo are offered for import into the new account.
  const own = state.mode === "demo" ? ownEvents(state.events) : [];
  return {
    ...state,
    mode: "account",
    account: { ...state.account, status: "signed-in", user },
    session: {
      ...(sameUser || upgraded ? state.session : { city: "", language: "English" }),
      ...sessionFromUser(user),
    },
    events: sameUser ? state.events : [],
    remote: sameUser ? state.remote : {},
    localImports: [...state.localImports.filter((e) => !own.some((o) => o.id === e.id)), ...own],
  };
}
/** The account's plans from the server; events still syncing (`skip`) keep the device's copy. */
function setPlans(state: AppState, { plans, skip = [] }: AppActionOf<"setPlans">): AppState {
  const keep = new Set(skip);
  const kept = state.events.filter((e) => keep.has(e.id));
  const fresh = plans.filter((p) => !keep.has(p.event.id)).map((p) => p.event);
  const remote = Object.fromEntries(
    plans.map((p) => [p.event.id, { version: p.version, role: p.role, side: p.side } satisfies RemoteMeta]),
  );
  return { ...state, events: [...fresh, ...kept], remote };
}
/** One plan as the server has it now; role and side carry over when the server didn't send them. */
function syncPlan(state: AppState, { plan }: AppActionOf<"syncPlan">): AppState {
  const { event, version } = plan;
  const prev = state.remote[event.id];
  const exists = state.events.some((e) => e.id === event.id);
  const meta: RemoteMeta = {
    version,
    role: plan.role ?? prev?.role ?? "viewer",
    side: plan.side !== undefined ? plan.side : (prev?.side ?? null),
  };
  return {
    ...state,
    events: exists ? state.events.map((e) => (e.id === event.id ? event : e)) : [...state.events, event],
    remote: { ...state.remote, [event.id]: meta },
  };
}
/** Marks the inbox read up to its newest entry, by the server's clock: a phone set to the wrong time still clears it. */
function readNotifications(state: AppState): AppState {
  const newest = state.activity[0]?.at;
  return {
    ...state,
    notificationsRead: true,
    inboxSeen: newest && newest > state.inboxSeen ? newest : state.inboxSeen,
  };
}
const APP_REDUCERS: {
  [T in AppAction["type"]]: (state: AppState, action: AppActionOf<T>) => AppState;
} = {
  signIn: (state) => ({ ...state, session: { ...state.session, signedIn: true } }),
  updateSession: (state, a) => ({ ...state, session: { ...state.session, ...a.patch } }),
  signOut: (state) => ({ ...state, session: { ...state.session, signedIn: false } }),
  resetDemo: (state) => ({
    ...initialState(),
    account: state.account,
    session: { ...DEMO_USER, signedIn: true },
  }),
  seedDemo: (state, a) =>
    state.mode === "demo"
      ? {
          ...state,
          seed: SEED_REVISION,
          demoShift: demoShift(),
          events: [...a.events, ...ownEvents(state.events)],
        }
      : state,
  addEvent: (state, a) => ({
    ...state,
    events: [...state.events.filter((e) => e.id !== a.event.id), a.event],
    remote: a.remote ? { ...state.remote, [a.event.id]: a.remote } : state.remote,
  }),
  methods: (state, a) => ({ ...state, account: { ...state.account, methods: a.methods } }),
  accountStatus: (state, a) => ({ ...state, account: { ...state.account, status: a.status } }),
  enterDemo: (state) => ({
    ...initialState(),
    draft: state.draft,
    account: { ...state.account, status: state.mode === "account" ? "signed-out" : state.account.status },
    session: { ...DEMO_USER, signedIn: true },
  }),
  enterAccount,
  leaveAccount: (state) => ({
    ...initialState(),
    draft: state.draft,
    account: { status: "signed-out", methods: state.account.methods },
  }),
  setPlans,
  syncPlan,
  syncStatus: (state, a) => ({ ...state, sync: { ...state.sync, ...a.patch } }),
  dropImport: (state, a) => ({ ...state, localImports: state.localImports.filter((e) => e.id !== a.id) }),
  draft: (state, a) => {
    const reprofiled = a.patch.profile !== undefined && a.patch.profile !== state.draft.profile;
    return { ...state, draft: { ...state.draft, ...(reprofiled ? { notes: undefined } : {}), ...a.patch } };
  },
  draftReset: (state, a) => ({ ...state, draft: freshDraft(a.forEvent) }),
  readNotifications,
  setActivity: (state, a) => ({ ...state, activity: a.activity }),
  toast: (state, a) => ({ ...state, toasts: [...state.toasts.filter((t) => t.id !== a.toast.id), a.toast] }),
  dismissToast: (state, a) => ({ ...state, toasts: state.toasts.filter((t) => t.id !== a.id) }),
};

/** The app's state after one action: plan changes go to the plan engine, the rest are handled here. */
export function reducer(state: AppState, action: Action): AppState {
  if (isEventAction(action)) return mapEvent(state, action.eventId, (e) => applyEventAction(e, action));
  // TypeScript can't correlate the table's key with its handler's argument; the table's type does.
  const reduce = APP_REDUCERS[action.type] as (state: AppState, action: AppAction) => AppState;
  return reduce(state, action);
}

/** A fresh state. The demo's sample events are passed in once loaded; tests pass them directly. */
export function initialState(demo: PlannrEvent[] = []): AppState {
  return {
    version: 2,
    demoShift: demoShift(),
    seed: demo.length > 0 ? SEED_REVISION : 0,
    mode: "demo",
    account: { status: "unknown" },
    remote: {},
    sync: { pending: 0, offline: false },
    localImports: [],
    session: { signedIn: false, ...DEMO_USER },
    events: demo,
    draft: freshDraft(),
    notificationsRead: false,
    activity: [],
    inboxSeen: new Date(0).toISOString(),
    toasts: [],
  };
}
