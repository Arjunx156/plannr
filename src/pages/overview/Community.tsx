import { useEditable } from "../../components/tasks";
import { Panel, StatTile, toneText } from "../../components/ui";
import { WatchList } from "../../components/watch";
import type { CommunityEvent } from "../../data/types";
import { longDate } from "../../lib/dates";
import { inr, inrShort, pct } from "../../lib/format";
import { communityReadiness } from "../../lib/metrics";
import { fundTotals } from "../../shared/derive";
import { toast, useStore } from "../../store/store";
import { ApprovalDecision } from "../tabs/community";
import { Notices } from "./Notices";
import { Tasks } from "./Tasks";

/** The overview of a community event: funds, permits, volunteers, stalls and what needs doing. */
export function Community({ ev, onOpenTask }: { ev: CommunityEvent; onOpenTask: (id: string) => void }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const r = communityReadiness(ev);
  const f = fundTotals(ev);
  const { received, expected } = f;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Readiness"
          value={`${pct(r.overall, 1)}%`}
          sub={`${r.permitsDone} of ${r.permitsTotal} permits cleared`}
          bar={r.overall}
          color="var(--color-peacock)"
        />
        <StatTile
          label="Funds"
          value={inrShort(received)}
          sub={`received of ${inrShort(expected)} · ${inrShort(ev.funds.spent)} spent`}
          bar={r.funds}
          color="var(--color-leaf)"
        />
        <StatTile
          label="Volunteers"
          value={`${r.volunteersFilled}/${r.volunteersNeeded}`}
          sub="shift places filled"
          bar={r.volunteers}
          color="var(--color-marigold)"
        />
        <StatTile
          label="Passes"
          value={`${f.passes.issued}`}
          sub={`of ${f.passes.capacity} · ${f.stalls.booked}/${f.stalls.total} stalls booked`}
          bar={r.passes}
        />
      </div>
      <WatchList ev={ev} />
      <Notices ev={ev} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Tasks ev={ev} onOpenTask={onOpenTask} />
        <Panel title="Permits & bookings">
          <ul className="m-0 flex list-none flex-col p-0">
            {ev.permits.map((p) => (
              <li key={p.label} className="flex justify-between gap-3 border-t border-sand-2 py-2.5 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className={`text-xs ${toneText(p.tone)}`}>{p.status}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Funds" id="approvals">
        <ul className="m-0 flex list-none flex-col p-0">
          {f.sources.map((s) => (
            <li
              key={s.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-sand-2 py-2.5 text-sm"
            >
              <span className="font-medium">{s.label}</span>
              <span className="tabular">
                {inr(s.received)} <span className="text-muted">/ {inr(s.expected)}</span>
              </span>
              <span className={`col-span-2 text-xs ${toneText(s.tone)}`}>{s.note}</span>
            </li>
          ))}
        </ul>
        <span className="eyebrow mt-2 text-muted">Waiting for the treasurer</span>
        <ul className="m-0 flex list-none flex-col p-0">
          {ev.funds.approvals.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{a.label}</span>
                <span className="text-xs text-muted">by {a.by}</span>
              </span>
              <span className="tabular">{inr(a.amount)}</span>
              <ApprovalDecision
                approval={a}
                canDecide={editable}
                waiting="waiting"
                onDecide={(status) => {
                  dispatch({ type: "approveExpense", eventId: ev.id, approvalId: a.id, status });
                  if (status === "approved") dispatch(toast(`Approved ${inr(a.amount)} for ${a.by}.`));
                }}
              />
            </li>
          ))}
        </ul>
      </Panel>
      <Shifts ev={ev} />
      <span className="text-xs text-muted">Event day: {longDate(ev.date)}</span>
    </>
  );
}

function Shifts({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  return (
    <Panel title="Volunteer shifts">
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable) */}
      <section className="scroll-x" aria-label="Volunteer shifts by role and time" tabIndex={0}>
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Role</th>
              {ev.shifts.slots.map((s) => (
                <th key={s} className="py-2 font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ev.shifts.roles.map((role) => (
              <tr key={role.role} className="border-t border-sand-2 align-top">
                <td className="py-2.5 pr-3 font-medium">{role.role}</td>
                {role.slots.map((slot, i) => {
                  const gap = slot.need - slot.names.length;
                  const busy = new Set(ev.shifts.roles.flatMap((r) => r.slots[i]?.names ?? []));
                  const free = ev.volunteers.filter((v) => !busy.has(v));
                  return (
                    <td key={`${role.role}-${ev.shifts.slots[i]}`} className="py-2.5 pr-3">
                      <div className="flex flex-col gap-1">
                        <span>{slot.names.join(", ") || <span className="text-muted">—</span>}</span>
                        {gap > 0 && !editable && <span className="text-xs text-rust-ink">Needs {gap}</span>}
                        {gap > 0 && editable && (
                          <label className="flex items-center gap-1.5 text-xs text-rust-ink">
                            <span>Needs {gap}</span>
                            <select
                              className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs text-ink"
                              value=""
                              aria-label={`Assign a volunteer to ${role.role}, ${ev.shifts.slots[i]}`}
                              onChange={(e) =>
                                e.target.value &&
                                dispatch({
                                  type: "assignShift",
                                  eventId: ev.id,
                                  role: role.role,
                                  slot: i,
                                  name: e.target.value,
                                })
                              }
                            >
                              <option value="">Assign…</option>
                              {free.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Panel>
  );
}
