import { type FormEvent, useState } from "react";
import { Field, Modal, Pill, TextField } from "../../../components/ui";
import type { Gift, PersonalEvent } from "../../../data/types";
import { inr, plural } from "../../../lib/format";
import { giftTotals } from "../../../shared/derive";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { DraftBox, newId, parseAmount, Section } from "../common";

/** A thank-you note for one gift, ready to edit and send. */
function thankYou(ev: PersonalEvent, g: Gift): string {
  const what = g.item ? `the lovely ${g.item}` : "your generous blessing";
  return `Dear ${g.from},\nThank you so much for being with us for ${ev.name} and for ${what}. It meant a great deal to the whole family.\nWith love and gratitude`;
}

export function Gifts({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const gifts = list(ev, "gifts");
  const households = list(ev, "households");
  const totals = giftTotals(ev);
  const [adding, setAdding] = useState(false);
  const [thanking, setThanking] = useState<Gift | null>(null);
  const [form, setForm] = useState({ from: "", householdId: "", amount: "", item: "" });
  const add = (e: FormEvent) => {
    e.preventDefault();
    const h = households.find((x) => x.id === form.householdId);
    const from = form.from.trim() || h?.name;
    if (!from) return;
    const amount = parseAmount(form.amount);
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "gifts",
      record: {
        id: newId("g"),
        from,
        ...(h ? { householdId: h.id } : {}),
        ...(amount ? { amount } : {}),
        ...(form.item.trim() ? { item: form.item.trim() } : {}),
      },
    });
    setForm({ from: "", householdId: "", amount: "", item: "" });
  };
  const phoneOf = (g: Gift) => households.find((h) => h.id === g.householdId)?.phone;
  return (
    <Section
      title="Gifts and shagun"
      aside={
        <span className="text-sm text-muted">
          {plural(totals.count, "gift")} · {inr(totals.cash)} · {totals.toThank} to thank
        </span>
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {gifts.map((g) => (
          <li
            key={g.id}
            className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{g.from}</span>
              <span className="text-xs text-muted">
                {[g.amount ? inr(g.amount) : "", g.item].filter(Boolean).join(" · ")}
              </span>
            </span>
            {g.thanked ? (
              <Pill tone="ok">thanked</Pill>
            ) : (
              editable && (
                <span className="flex gap-1.5">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setThanking(g)}>
                    Say thank you
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      dispatch({
                        type: "updateRecord",
                        eventId: ev.id,
                        coll: "gifts",
                        id: g.id,
                        patch: { thanked: true },
                      })
                    }
                  >
                    Thanked
                  </button>
                </span>
              )
            )}
          </li>
        ))}
        {!gifts.length && (
          <li className="text-sm text-muted">
            Gifts and envelopes go here as they come in, so no one is missed in the thank-yous.
          </li>
        )}
      </ul>
      {editable &&
        (adding ? (
          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_1fr_auto] sm:items-end">
            <TextField
              id="gift-from"
              label="From"
              value={form.from}
              onChange={(from) => setForm({ ...form, from })}
              placeholder="Name"
            />
            <Field label="Household" htmlFor="gift-hh">
              <select
                id="gift-hh"
                className="field"
                value={form.householdId}
                onChange={(e) => setForm({ ...form, householdId: e.target.value })}
              >
                <option value="">Not on the list</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
            <TextField
              id="gift-amount"
              label="Cash (₹)"
              value={form.amount}
              onChange={(amount) => setForm({ ...form, amount })}
              inputMode="decimal"
            />
            <TextField
              id="gift-item"
              label="Gift"
              value={form.item}
              onChange={(item) => setForm({ ...form, item })}
              placeholder="Silver lamp"
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm h-10"
              disabled={!form.from.trim() && !form.householdId}
            >
              Add
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setAdding(true)}>
            + Record a gift
          </button>
        ))}
      <Modal
        open={!!thanking}
        onClose={() => setThanking(null)}
        title={thanking ? `Thank ${thanking.from}` : "Thank you"}
        width={560}
      >
        {thanking && (
          <DraftBox
            task="thanks"
            phone={phoneOf(thanking)}
            context={{
              event: ev.name,
              from: thanking.from,
              gift: thanking.item,
              amount: thanking.amount ? "a cash gift" : undefined,
            }}
            fallback={thankYou(ev, thanking)}
            saveLabel="Mark thanked"
            onSave={(text) => {
              dispatch({
                type: "updateRecord",
                eventId: ev.id,
                coll: "gifts",
                id: thanking.id,
                patch: { thanked: true, thankNote: text },
              });
              setThanking(null);
            }}
          />
        )}
      </Modal>
    </Section>
  );
}
