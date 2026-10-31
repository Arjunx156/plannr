import { type JSX, useCallback } from "react";
import { LoadError, useRemote } from "../../components/remote";
import { Pill, Spinner } from "../../components/ui";
import type { PlannrEvent } from "../../data/types";
import { api } from "../../lib/api";
import { initials } from "../../lib/format";
import { errorMessage, oneOf } from "../../shared/guards";
import { type Member, ROLE_LABEL, type Role } from "../../shared/types";
import { canEdit, toast, useStore } from "../../store/store";
import { TabPage } from "./layout";
import { NeedsAccount } from "./NeedsAccount";
import { Invite } from "./people/Invite";

/** The roles an owner can give; there is one owner, and ownership never moves. */
const GRANTABLE: Exclude<Role, "owner">[] = ["planner", "viewer"];

/** Co-planners and their roles, with invites for new ones. */
export function PeopleTab({ ev }: { ev: PlannrEvent }): JSX.Element {
  const { state, dispatch } = useStore();
  const me = state.account.user?.id;
  const role = state.remote[ev.id]?.role;
  const owner = role === "owner";
  const account = state.mode === "account";
  const load = useCallback(() => api.members(ev.id), [ev.id]);
  const people = useRemote(account ? load : undefined);
  const members = people.data;

  if (!account)
    return (
      <NeedsAccount ev={ev} title="People">
        Plan together: invite family as co-planners who can change the plan, or let others follow along. Every
        change shows who made it.
      </NeedsAccount>
    );

  const change = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      dispatch(toast(done));
      people.reload();
    } catch (e) {
      dispatch(toast(errorMessage(e)));
    }
  };

  return (
    <TabPage eyebrow={ev.name} title="People">
      <section
        aria-label="Who's planning"
        className="flex flex-col rounded-2xl border border-line bg-surface"
      >
        {people.error && (
          <LoadError what="the people on this plan" error={people.error} onRetry={people.reload} />
        )}
        {members === null && !people.error && (
          <div className="flex justify-center py-10">
            <Spinner label="Loading people" />
          </div>
        )}
        {members && (
          <ul className="m-0 flex list-none flex-col p-0">
            {members.map((m, i) => (
              <MemberRow
                key={m.userId}
                member={m}
                you={m.userId === me}
                first={i === 0}
                manage={owner && m.role !== "owner"}
                onRole={(next) =>
                  change(
                    () => api.updateMember(ev.id, m.userId, { role: next }),
                    `${m.name} is now ${ROLE_LABEL[next].toLowerCase()}.`,
                  )
                }
                onRemove={() => change(() => api.removeMember(ev.id, m.userId), `Removed ${m.name}.`)}
              />
            ))}
          </ul>
        )}
      </section>
      {canEdit(role) ? (
        <Invite ev={ev} />
      ) : (
        <p className="m-0 text-body text-sm">
          Only co-planners can invite people. Ask the owner if someone's missing.
        </p>
      )}
    </TabPage>
  );
}

/** One member: who they are, and for the owner, their role and a way to remove them. */
function MemberRow({
  member: m,
  you,
  first,
  manage,
  onRole,
  onRemove,
}: {
  member: Member;
  you: boolean;
  first: boolean;
  /** The owner sees controls for everyone but themselves. */
  manage: boolean;
  onRole: (role: Exclude<Role, "owner">) => void;
  onRemove: () => void;
}) {
  return (
    <li className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${first ? "" : "border-sand-2 border-t"}`}>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-peacock-tint font-semibold text-peacock-deep text-xs"
      >
        {initials(m.name || "?")}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-sm">
          {m.name || "Unnamed"}
          {you && <span className="font-normal text-muted"> (you)</span>}
        </span>
        <span className="truncate text-muted text-xs">
          {m.guest ? "Guest" : m.email}
          {m.side ? ` · ${m.side}` : ""}
        </span>
      </span>
      {manage ? (
        <span className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`role-${m.userId}`}>
            Role for {m.name}
          </label>
          <select
            id={`role-${m.userId}`}
            className="field h-9 min-h-0 appearance-auto py-0 text-sm"
            value={m.role}
            onChange={(e) => {
              const role = oneOf(e.target.value, GRANTABLE);
              if (role) onRole(role);
            }}
          >
            {GRANTABLE.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-sm text-rust-ink" onClick={onRemove}>
            Remove
          </button>
        </span>
      ) : (
        <Pill tone={m.role === "owner" ? "ok" : "idle"}>{ROLE_LABEL[m.role]}</Pill>
      )}
    </li>
  );
}
