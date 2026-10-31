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
import { SEED_REVISION } from "../data/demoMeta";
import type { PlannrEvent } from "../data/types";
import { isEventAction, QUIET_ACTIONS, stamp } from "../shared/engine";
import { canEdit } from "../shared/types";
import { initialState, ownEvents, reducer } from "./reducer";
import { SyncQueue } from "./sync";
import type { Action, AppState } from "./types";

const STORAGE_KEY = "plannr:v1";

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
  if (saved.version === 2 && saved.demoShift === fresh.demoShift && saved.seed === SEED_REVISION)
    return state;
  // Older samples, or an earlier week: keep the planner's own events and load the samples afresh.
  const own = ownEvents(saved.events);
  return { ...state, demoShift: fresh.demoShift, seed: 0, events: own };
}

/** The demo is open but its sample events haven't arrived yet. */
export function demoLoading(state: AppState): boolean {
  return state.mode === "demo" && state.session.signedIn && state.seed !== SEED_REVISION;
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  sync: SyncQueue;
}

export { canEdit };

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

  // The demo's sample events load when someone opens the demo, never for a visitor who doesn't.
  const loadDemo = demoLoading(state);
  useEffect(() => {
    if (!loadDemo) return;
    let live = true;
    import("../data/seed")
      .then((m) => live && raw({ type: "seedDemo", events: m.seedEvents() }))
      .catch(() => live && raw(toast("Couldn't load the sample events. Check the connection and reload.")));
    return () => {
      live = false;
    };
  }, [loadDemo]);

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
