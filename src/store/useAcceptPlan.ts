import { useNavigate } from "react-router";
import { eventFromDraft } from "../lib/newEvent";
import { draftPlan } from "../lib/plan";
import { toast, useStore } from "./store";

/** Turns the current draft into a live event and opens its dashboard. */
export function useAcceptPlan() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  return () => {
    const { draft, session } = state;
    const plan = draftPlan(draft.profile);
    const existing = state.events.find((e) => e.id === draft.forEvent);
    const event = eventFromDraft(draft.profile, plan, session, existing);
    dispatch({ type: "addEvent", event });
    dispatch({ type: "draftReset" });
    dispatch(toast(`${event.name} is live. Every change from here waits for your approval.`));
    navigate(`/events/${event.id}`);
  };
}
