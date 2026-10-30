import { type FormEvent, useState } from "react";
import { Field, Pill } from "../../../components/ui";
import type { CommunityEvent, Sponsor } from "../../../data/types";
import { inr } from "../../../lib/format";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId, parseAmount, Section } from "../common";

/** Sponsors by tier, what each pledged and what has arrived. */
export function Sponsors({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const sponsors = list(ev, "sponsors");
  const [form, setForm] = useState({ name: "", tier: "", amount: "" });
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
            {s.received >= s.amount ? (
              <Pill tone="ok">paid</Pill>
            ) : editable ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
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
              >
                Received
              </button>
            ) : (
              <Pill tone="due">due</Pill>
            )}
          </li>
        ))}
        {!sponsors.length && <li className="text-sm text-muted">No sponsors yet.</li>}
      </ul>
      {editable && (
        <form onSubmit={add} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
          <Field label="Sponsor" htmlFor="sp-name">
            <input
              id="sp-name"
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Tier" htmlFor="sp-tier">
            <input
              id="sp-tier"
              className="field"
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
              placeholder="Gold"
            />
          </Field>
          <Field label="Amount" htmlFor="sp-amount">
            <input
              id="sp-amount"
              className="field"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
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
