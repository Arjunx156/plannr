import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import { Modal } from "../../../components/overlays";
import type { PayMethod, Payment } from "../../../data/budgetTypes";
import type { PersonalEvent } from "../../../data/types";
import { TODAY } from "../../../lib/dates";
import { inr } from "../../../lib/format";
import { toast, useStore } from "../../../store/store";
import { METHOD_LABEL } from "./shared";

export function MarkPaid({
  ev,
  payment,
  onClose,
}: {
  ev: PersonalEvent;
  payment: Payment | null;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const sides = ev.budget.split?.sides ?? [];
  const [on, setOn] = useState(TODAY);
  const [method, setMethod] = useState<PayMethod>("upi");
  const [by, setBy] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    dispatch({
      type: "markPaid",
      eventId: ev.id,
      paymentId: payment.id,
      paid: true,
      on,
      method,
      by: by || payment.by,
    });
    dispatch(toast(`Marked ${inr(payment.amount)} paid. The budget and the family split now include it.`));
    onClose();
  };
  return (
    <Modal open={!!payment} onClose={onClose} title={payment ? `Paid: ${payment.label}` : "Paid"}>
      {payment && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <span className="font-serif text-[28px] leading-none tabular">{inr(payment.amount)}</span>
          <Field label="Paid on" htmlFor="paid-on">
            <input
              id="paid-on"
              type="date"
              className="field"
              value={on}
              max={TODAY}
              onChange={(e) => setOn(e.target.value)}
            />
          </Field>
          <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
            <legend className="label mb-1.5">How</legend>
            {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                className="chip chip-sm"
                onClick={() => setMethod(m)}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </fieldset>
          {sides.length > 0 && (
            <Field label="Paid by" htmlFor="paid-by">
              <select
                id="paid-by"
                className="field"
                value={by || payment.by || ""}
                onChange={(e) => setBy(e.target.value)}
              >
                <option value="">Not counted in the split</option>
                {sides.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <button type="submit" className="btn btn-primary self-start">
            Mark paid
          </button>
        </form>
      )}
    </Modal>
  );
}
