import { useCallback, useEffect, useRef } from "react";
import { ApiError, api } from "../lib/api";
import type { AccountUser } from "../shared/types";
import { toast, useStore } from "./store";

/** How often an open plan checks the server for changes made by co-planners. */
const FRESHNESS_MS = 8000;

/** Signing in and out, and keeping an account's plans in step with the server. */
export function useAccount() {
  const { dispatch, sync } = useStore();

  const refreshPlans = useCallback(async () => {
    try {
      const plans = await api.plans();
      dispatch({ type: "setPlans", plans, skip: sync.pendingIds() });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) dispatch({ type: "leaveAccount" });
    }
  }, [dispatch, sync]);

  /** Call after the server has started a session: loads the account and its plans. */
  const signedIn = useCallback(async (): Promise<AccountUser | null> => {
    const user = await api.me();
    if (!user) return null;
    dispatch({ type: "enterAccount", user });
    await refreshPlans();
    return user;
  }, [dispatch, refreshPlans]);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // The cookie goes stale on its own; this device forgets the account either way.
    }
    dispatch({ type: "leaveAccount" });
  }, [dispatch]);

  return { refreshPlans, signedIn, signOut };
}

/**
 * Mounted once: learns what the server offers, picks up an existing session, and reloads
 * the plan list whenever the tab comes back into view.
 */
export function AccountSync() {
  const { state, dispatch } = useStore();
  const { refreshPlans } = useAccount();
  const mode = useRef(state.mode);
  mode.current = state.mode;

  useEffect(() => {
    let live = true;
    api.methods().then((methods) => live && dispatch({ type: "methods", methods }));
    api
      .me()
      .then(async (user) => {
        if (!live) return;
        if (user) {
          dispatch({ type: "enterAccount", user });
          await refreshPlans();
        } else if (mode.current === "account") {
          dispatch({ type: "leaveAccount" });
          dispatch(toast("You've been signed out. Sign in again to see your plans."));
        } else dispatch({ type: "accountStatus", status: "signed-out" });
      })
      .catch(() => {
        // Offline: an account keeps showing what this device saved; anyone else can still use the demo.
        if (live && mode.current !== "account") dispatch({ type: "accountStatus", status: "signed-out" });
      });
    return () => {
      live = false;
    };
  }, [dispatch, refreshPlans]);

  useEffect(() => {
    let last = 0;
    const back = () => {
      if (document.hidden || mode.current !== "account" || Date.now() - last < 5000) return;
      last = Date.now();
      void refreshPlans();
    };
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
    };
  }, [refreshPlans]);

  return null;
}

/** While a shared plan is open, picks up co-planners' changes within a few seconds. */
export function usePlanFreshness(id: string | undefined) {
  const { state, dispatch, sync } = useStore();
  const { refreshPlans } = useAccount();
  const version = useRef(0);
  version.current = (id && state.remote[id]?.version) || 0;
  const account = state.mode === "account";

  useEffect(() => {
    if (!account || !id) return;
    let live = true;
    const check = async () => {
      if (document.hidden || sync.has(id)) return;
      try {
        const latest = await api.version(id);
        if (latest <= version.current || sync.has(id)) return;
        const plan = await api.plan(id);
        if (live && !sync.has(id)) dispatch({ type: "syncPlan", plan });
      } catch (e) {
        if (live && e instanceof ApiError && e.status === 404) {
          dispatch(toast("This plan is no longer shared with you."));
          void refreshPlans();
        }
      }
    };
    const timer = window.setInterval(check, FRESHNESS_MS);
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [account, id, dispatch, sync, refreshPlans]);
}
