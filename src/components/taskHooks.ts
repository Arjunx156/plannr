import { useState } from "react";
import type { Task } from "../data/baseTypes";
import type { PlannrEvent } from "../data/types";
import { canEdit } from "../shared/types";
import { toast, useStore } from "../store/store";

/** Whether this person may change the plan: always in the demo, by role with an account. */
export function useEditable(ev: PlannrEvent | undefined): boolean {
  const { state } = useStore();
  if (!ev || state.mode !== "account") return true;
  return canEdit(state.remote[ev.id]?.role);
}

/**
 * Ticking a task keeps it in place, struck through, for the rest of the visit, so the tick
 * stays visible and can be undone from the toast.
 */
export function useTaskToggle(ev: PlannrEvent | undefined) {
  const { dispatch } = useStore();
  const [ticked, setTicked] = useState<string[]>([]);
  const toggle = (t: Task) => {
    if (!ev) return;
    setTicked((prev) => (prev.includes(t.id) ? prev : [...prev, t.id]));
    dispatch({ type: "toggleTask", eventId: ev.id, taskId: t.id });
    if (!t.done) dispatch(toast(`Done: ${t.title}`, { type: "toggleTask", eventId: ev.id, taskId: t.id }));
  };
  return { toggle, ticked };
}
