import type { Message, Preview } from "../data/messageTypes";
import type { CommunityEvent, PersonalEvent } from "../data/types";
import { TODAY } from "../lib/dates";
import { proposalRipple } from "../shared/proposals";
import { useStore } from "../store/store";
import { RipplePreview } from "./ripple";

export function PreviewCard({ preview, onDecide }: { preview: Preview; onDecide: (apply: boolean) => void }) {
  return (
    <div className="card-ai flex flex-col gap-2.5 rounded-xl p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{preview.title}</span>
        <span className="pill pill-ai">{preview.tag}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {preview.rows.map((r) => (
          <li key={r.title} className="flex flex-col gap-0.5 text-[13px] leading-[1.4]">
            <span className={`flex justify-between gap-2 font-medium ${r.headsUp ? "text-amber-ink" : ""}`}>
              {r.title}
              {r.amount && <span className="tabular">{r.amount}</span>}
            </span>
            {r.from && (
              <span className="text-muted">
                <s>{r.from}</s> → <span className="text-ink">{r.to}</span>
              </span>
            )}
            {r.detail && <span className="text-muted">{r.detail}</span>}
          </li>
        ))}
      </ul>
      {preview.status === "pending" ? (
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecide(true)}>
            Apply changes
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDecide(false)}>
            Not now
          </button>
        </div>
      ) : (
        <span
          className={`text-xs font-semibold ${preview.status === "applied" ? "text-leaf-ink" : "text-muted"}`}
        >
          {preview.status === "applied" ? "✓ Applied" : "Not applied"}
        </span>
      )}
    </div>
  );
}
/** Changes the assistant proposed, as a preview of everything they move, applied only on yes. */
export function Proposal({ ev, m }: { ev: PersonalEvent | CommunityEvent; m: Message }) {
  const { dispatch } = useStore();
  const status = m.proposalStatus ?? "pending";
  if (status !== "pending")
    return (
      <span className={`text-xs font-semibold ${status === "applied" ? "text-leaf-ink" : "text-muted"}`}>
        {status === "applied" ? "✓ Applied" : "Not applied"}
      </span>
    );
  const ripple = proposalRipple(ev, m.proposals ?? [], TODAY);
  if (!ripple)
    return (
      <span className="text-xs text-muted">The suggested change no longer fits the plan as it is now.</span>
    );
  const decide = (s: "applied" | "rejected") =>
    dispatch({ type: "previewStatus", eventId: ev.id, messageId: m.id, status: s });
  return (
    <RipplePreview ripple={ripple} onDone={() => decide("applied")} onCancel={() => decide("rejected")} />
  );
}
