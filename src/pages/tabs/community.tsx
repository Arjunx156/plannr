import type { ReactNode } from "react";
import { Link } from "react-router";
import { useEditable } from "../../components/taskHooks";
import { Pill } from "../../components/ui";
import type { Approval } from "../../data/communityTypes";
import type { CommunityEvent, PlannrEvent } from "../../data/types";
import { useStore } from "../../store/store";
import { TabPage } from "./layout";

/** Shown when a community-only page is opened for a wedding or birthday. */
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

/** An expense claim's outcome, or Approve and Decline for whoever may decide it. */
export function ApprovalDecision({
  approval,
  canDecide,
  waiting,
  onDecide,
}: {
  approval: Approval;
  canDecide: boolean;
  /** What a pending claim says to someone who can't decide it. */
  waiting: string;
  onDecide: (status: "approved" | "declined") => void;
}) {
  if (approval.status !== "pending")
    return <Pill tone={approval.status === "approved" ? "ok" : "idle"}>{approval.status}</Pill>;
  if (!canDecide) return <Pill tone="due">{waiting}</Pill>;
  return (
    <span className="flex gap-1.5">
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecide("approved")}>
        Approve
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDecide("declined")}>
        Decline
      </button>
    </span>
  );
}

/** The volunteer rota as a table that scrolls sideways on a phone: roles down, time slots across. */
export function ShiftGrid({
  slots,
  wide,
  children,
}: {
  slots: string[];
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable)
    <section className="scroll-x" aria-label="Volunteer shifts by role and time" tabIndex={0}>
      <table className={`w-full border-collapse text-sm ${wide ? "min-w-[720px]" : "min-w-[620px]"}`}>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-2 font-medium">Role</th>
            {slots.map((s) => (
              <th key={s} className="py-2 font-medium">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

/** Volunteers not on any role during one time slot. */
export function freeVolunteers(ev: CommunityEvent, slot: number): string[] {
  const busy = new Set(ev.shifts.roles.flatMap((r) => r.slots[slot]?.names ?? []));
  return ev.volunteers.filter((v) => !busy.has(v));
}

/** "Assign…": puts one of the free volunteers on a role's slot. */
export function AssignSelect({
  label,
  free,
  className,
  onAssign,
}: {
  /** "Food safety, 5–8 pm" */
  label: string;
  free: string[];
  className: string;
  onAssign: (name: string) => void;
}) {
  return (
    <select
      className={className}
      value=""
      aria-label={`Assign a volunteer to ${label}`}
      onChange={(e) => {
        if (e.target.value) onAssign(e.target.value);
      }}
    >
      <option value="">Assign…</option>
      {free.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}
