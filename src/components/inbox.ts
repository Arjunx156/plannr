import { useEffect, useMemo } from "react";
import { seedNotifications } from "../data/seed";
import { api } from "../lib/api";
import { useStore } from "../store/store";

/** How often an open screen checks for co-planners' changes; a hidden tab doesn't check. */
const ACTIVITY_MS = 30_000;

/** Keeps the account's recent activity fresh while a signed-in screen is open. */
export function useActivity() {
  const { state, dispatch } = useStore();
  const account = state.mode === "account" && !!state.account.user;
  useEffect(() => {
    if (!account) return;
    let live = true;
    const load = () => {
      if (document.hidden) return;
      api
        .activity()
        .then((activity) => live && dispatch({ type: "setActivity", activity }))
        // A missed poll is tried again on the next one.
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, ACTIVITY_MS);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [account, dispatch]);
}

export interface InboxItem {
  id: string;
  text: string;
  /** ISO time for account activity; already-written words for the demo's. */
  at?: string;
  when?: string;
  by?: string | null;
  eventId?: string;
  eventName?: string;
  unread: boolean;
}

/** What the inbox shows: co-planners' changes with an account, the story's updates in the demo. */
export function useInbox(): InboxItem[] {
  const { state } = useStore();
  return useMemo(() => {
    if (state.mode === "demo")
      return seedNotifications().map((n) => ({
        id: n.id,
        text: n.text,
        when: n.when,
        eventId: n.eventId,
        eventName: state.events.find((e) => e.id === n.eventId)?.name,
        unread: n.unread && !state.notificationsRead,
      }));
    return state.activity
      .filter((a) => !a.mine)
      .map((a) => ({
        id: a.id,
        text: a.summary,
        at: a.at,
        by: a.by,
        eventId: a.eventId,
        eventName: a.eventName,
        unread: a.at > state.inboxSeen,
      }));
  }, [state.mode, state.activity, state.events, state.notificationsRead, state.inboxSeen]);
}

export function useUnread(): number {
  return useInbox().filter((i) => i.unread).length;
}
