import { useState } from "react";
import { Modal } from "../../../components/overlays";
import { useEditable } from "../../../components/taskHooks";
import { Pill } from "../../../components/ui";
import type { Stall } from "../../../data/communityTypes";
import type { CommunityEvent } from "../../../data/types";
import { inr, plural } from "../../../lib/format";
import { fundTotals } from "../../../shared/balances";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { Section, Stat, TabPage } from "../layout";
import { ShareLink } from "../ShareLink";
import { Passes } from "./Passes";
import { StallForm } from "./StallForm";

/** Stalls and passes for a community event: requests to decide, fees to collect, passes to issue. */
export function Stalls({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const stalls = list(ev, "stalls");
  const [adding, setAdding] = useState(false);
  const aside = (
    <span className="flex flex-wrap gap-2">
      <ShareLink
        ev={ev}
        kind="stalls"
        label="Share stall requests"
        message={`Want a stall at ${ev.name}? Request one here:`}
      />
      {editable && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
          + Stall
        </button>
      )}
    </span>
  );
  return (
    <TabPage eyebrow={ev.name} title="Stalls & passes" wide>
      <StallStats ev={ev} stalls={stalls} />
      <Section title="Stalls" aside={aside}>
        <Requests ev={ev} stalls={stalls} editable={editable} />
        <Confirmed ev={ev} stalls={stalls} editable={editable} />
        <Modal open={adding} onClose={() => setAdding(false)} title="Add a stall">
          <StallForm
            fee={Math.max(0, ...stalls.map((s) => s.fee))}
            onAdd={(s) => {
              dispatch({ type: "addRecord", eventId: ev.id, coll: "stalls", record: s });
              setAdding(false);
            }}
          />
        </Modal>
      </Section>
      <Passes ev={ev} editable={editable} />
    </TabPage>
  );
}

interface ListProps {
  ev: CommunityEvent;
  stalls: Stall[];
  editable: boolean;
}

function StallStats({ ev, stalls }: Omit<ListProps, "editable">) {
  const f = fundTotals(ev);
  const confirmed = stalls.filter((s) => s.status === "confirmed");
  const collected = confirmed.filter((s) => s.paid).reduce((t, s) => t + s.fee, 0);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat
        label="Stalls"
        value={`${f.stalls.booked}/${f.stalls.total}`}
        sub={`${plural(f.stalls.requested, "request")} waiting`}
      />
      <Stat label="Fees paid" value={`${f.stalls.paid}/${confirmed.length}`} sub={inr(collected)} />
      <Stat label="Passes" value={f.passes.issued} sub={`of ${f.passes.capacity} capacity`} />
      <Stat label="Inside" value={f.passes.checkedIn} sub="checked in at the gate" />
    </div>
  );
}

/** Stall requests from the shared link, each to confirm (while stalls are left) or decline. */
function Requests({ ev, stalls, editable }: ListProps) {
  const { dispatch } = useStore();
  const requests = stalls.filter((s) => s.status === "requested");
  const f = fundTotals(ev);
  if (requests.length === 0) return null;
  const confirm = (s: Stall) =>
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "stalls",
      id: s.id,
      patch: { status: "confirmed" },
    });
  const decline = (s: Stall) => dispatch({ type: "removeRecord", eventId: ev.id, coll: "stalls", id: s.id });
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-line bg-cream p-3.5">
      <span className="font-semibold text-amber-ink">{plural(requests.length, "request")} to decide</span>
      {requests.map((s) => (
        <span key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <strong>{s.name}</strong> · {s.owner}
            {s.category ? ` · ${s.category}` : ""}
            {s.phone && (
              <>
                {" · "}
                <a href={`tel:${s.phone}`} className="link">
                  call
                </a>
              </>
            )}
          </span>
          {editable && (
            <span className="flex gap-1.5">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={f.stalls.booked >= f.stalls.total}
                onClick={() => confirm(s)}
              >
                Confirm
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => decline(s)}>
                Decline
              </button>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function Confirmed({ ev, stalls, editable }: ListProps) {
  const { dispatch } = useStore();
  const setPaid = (s: Stall, paid: boolean) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "stalls", id: s.id, patch: { paid } });
  return (
    <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2">
      {stalls
        .filter((s) => s.status === "confirmed")
        .map((s) => (
          <li key={s.id} className="flex items-center gap-2 border-t border-sand-2 py-2 text-sm">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">
                {s.owner}
                {s.category ? ` · ${s.category}` : ""}
              </span>
            </span>
            <span className="tabular text-xs">{inr(s.fee)}</span>
            {editable ? (
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={s.paid} onChange={(e) => setPaid(s, e.target.checked)} />
                paid
              </label>
            ) : (
              <Pill tone={s.paid ? "ok" : "due"}>{s.paid ? "paid" : "due"}</Pill>
            )}
          </li>
        ))}
    </ul>
  );
}
