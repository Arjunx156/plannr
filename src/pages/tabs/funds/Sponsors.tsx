import { type FormEvent, useState } from "react";
import { bindText, TextField } from "../../../components/fields";
import { Pill } from "../../../components/ui";
import type { Sponsor } from "../../../data/communityTypes";
import type { CommunityEvent } from "../../../data/types";
import { inr, parseAmount } from "../../../lib/format";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

/** Sponsors by tier, what each pledged and what has arrived. */
export function Sponsors({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const sponsors = list(ev, "sponsors");
  const [form, setForm] = useState({ name: "", tier: "", amount: "" });
  const field = bindText(form, setForm);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(form.amount);
    if (!form.name.trim() || !amount) return;
    const record: Sponsor = {
      id: newId("sp"),
      name: form.name.trim(),
      tier: form.tier.trim() || "Supporter",
      amount,
      received: 0,
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "sponsors", record });
    setForm({ name: "", tier: "", amount: "" });
  };
  return (
    <Section title="Sponsors">
      <ul className="m-0 flex list-none flex-col p-0">
        {sponsors.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">{s.tier}</span>
            </span>
            <span className="tabular">{inr(s.amount)}</span>
            <SponsorStatus
              sponsor={s}
              editable={editable}
              onReceived={() => {
                dispatch({
                  type: "updateRecord",
                  eventId: ev.id,
                  coll: "sponsors",
                  id: s.id,
                  patch: { received: s.amount },
                });
                dispatch(
                  toast(`${s.name}'s ${inr(s.amount)} is in. Their name now shows on the fund report.`),
                );
              }}
            />
          </li>
        ))}
        {sponsors.length === 0 && <li className="text-sm text-muted">No sponsors yet.</li>}
      </ul>
      {editable && (
        <form onSubmit={add} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
          <TextField id="sp-name" label="Sponsor" {...field("name")} />
          <TextField id="sp-tier" label="Tier" {...field("tier")} placeholder="Gold" />
          <TextField id="sp-amount" label="Amount" {...field("amount")} inputMode="decimal" />
          <button
            type="submit"
            className="btn btn-secondary btn-sm h-10"
            disabled={!form.name.trim() || !parseAmount(form.amount)}
          >
            Add
          </button>
        </form>
      )}
    </Section>
  );
}

/** Paid, due, or (for planners) a button to mark the money received. */
function SponsorStatus({
  sponsor,
  editable,
  onReceived,
}: {
  sponsor: Sponsor;
  editable: boolean;
  onReceived: () => void;
}) {
  if (sponsor.received >= sponsor.amount) return <Pill tone="ok">paid</Pill>;
  if (!editable) return <Pill tone="due">due</Pill>;
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={onReceived}>
      Received
    </button>
  );
}
