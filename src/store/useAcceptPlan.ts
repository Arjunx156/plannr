import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { eventFromDraft } from "../lib/newEvent";
import { draftPlan } from "../lib/plan";
import { toast, useStore } from "./store";

/**
 * Turns the current draft into a live event and opens its dashboard. With an account the
 * plan is saved on the server first, so it's there on every device before anyone opens it.
 * Resolves false when it couldn't be saved; the draft is kept so nothing is lost.
 * Gemini's ideas for the draft start the new event's ideas board.
 */
export function useAcceptPlan() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  return async (): Promise<boolean> => {
    const { draft, session } = state;
    const plan = draftPlan(draft.profile);
    const existing = state.events.find((e) => e.id === draft.forEvent);
    const event = eventFromDraft(draft.profile, plan, session, existing, draft.ideas ?? []);
    if (state.mode === "account" && existing && state.remote[existing.id]) {
      dispatch({ type: "replacePlan", eventId: existing.id, event });
    } else if (state.mode === "account") {
      try {
        dispatch({ type: "syncPlan", plan: await api.createPlan(event) });
      } catch (e) {
        dispatch(toast(`Couldn't save the plan yet: ${(e as Error).message}`));
        return false;
      }
    } else dispatch({ type: "addEvent", event });
    dispatch({ type: "draftReset" });
    dispatch(toast(`${event.name} is live. Every change from here waits for your approval.`));
    navigate(`/events/${event.id}`);
    return true;
  };
}
