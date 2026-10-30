import { Link } from "react-router";
import { useEditable } from "../../components/tasks";
import type { PlannrEvent } from "../../data/types";
import { useStore } from "../../store/store";
import { TabPage } from "./common";

export function NotCommunity({ ev, title }: { ev: PlannrEvent; title: string }) {
  return (
    <TabPage eyebrow={ev.name} title={title}>
      <p className="m-0 text-body">
        This is for community events.{" "}
        <Link to={`/events/${ev.id}`} className="link">
          Back to the overview
        </Link>
      </p>
    </TabPage>
  );
}

/** Whether this person decides on expenses: the treasurer, the owner, or anyone in the demo. */
export function useDecides(ev: PlannrEvent): { decides: boolean; why?: string } {
  const { state } = useStore();
  const editable = useEditable(ev);
  if (state.mode !== "account") return { decides: true };
  const me = state.remote[ev.id];
  if (!editable) return { decides: false };
  if (me?.role === "owner" || me?.side?.trim().toLowerCase() === "treasurer") return { decides: true };
  // The server has the final say: it refuses if another member is the treasurer.
  return { decides: true, why: "If the committee has a treasurer, only they or the owner can approve." };
}
