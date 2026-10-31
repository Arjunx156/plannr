import { type FormEvent, useState } from "react";
import { Field } from "../../components/fields";
import { Modal } from "../../components/overlays";
import type { PersonalEvent } from "../../data/types";
import { inr } from "../../lib/format";
import { toast, useStore } from "../../store/store";

/** Books the photographer a notice recommends, with the quote and payment it sets up. */
export function BookPhotographer({
  ev,
  open,
  onClose,
}: {
  ev: PersonalEvent;
  open: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const [studio, setStudio] = useState("");
  const [price, setPrice] = useState("");
  const amount = Number(price.replace(/[^\d]/g, ""));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!studio.trim() || !amount) return;
    dispatch({ type: "bookPhotographer", eventId: ev.id, studio: studio.trim(), price: amount });
    dispatch(toast(`Booked ${studio.trim()} for ${inr(amount)}.`));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Book the photographer">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <p className="m-0 text-sm text-body">
          Which of your shortlisted studios did you choose? The budget, vendor list and task update together.
        </p>
        <Field label="Studio" htmlFor="studio">
          <input id="studio" className="field" value={studio} onChange={(e) => setStudio(e.target.value)} />
        </Field>
        <Field label="Package price (₹)" htmlFor="price">
          <input
            id="price"
            className="field"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2,40,000"
          />
        </Field>
        <button type="submit" className="btn btn-primary self-start" disabled={!studio.trim() || !amount}>
          Book {amount ? inr(amount) : ""}
        </button>
      </form>
    </Modal>
  );
}

export function Savings({
  ev,
  open,
  onClose,
  onAsk,
}: {
  ev: PersonalEvent;
  open: boolean;
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Ways to save">
      {ev.budget.savings.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {ev.budget.savings.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 rounded-xl bg-sand p-3.5">
              <span className="flex justify-between gap-3 font-semibold">
                {s.title}
                <span className="tabular text-leaf-ink">−{inr(s.amount)}</span>
              </span>
              <span className="text-sm text-body">{s.why}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-body">No savings ideas yet. Ask Plannr where the budget is tight.</p>
      )}
      <button
        type="button"
        className="btn btn-secondary self-start"
        onClick={() => {
          onClose();
          onAsk("Where are we over, and what would you cut first?");
        }}
      >
        Ask Plannr to compare
      </button>
    </Modal>
  );
}
