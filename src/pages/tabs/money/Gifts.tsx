import { type FormEvent, useState } from "react";
import { bindText, Field, TextField } from "../../../components/fields";
import { Modal } from "../../../components/overlays";
import { Pill } from "../../../components/ui";
import type { Gift } from "../../../data/budgetTypes";
import type { Household } from "../../../data/guestTypes";
import type { PersonalEvent } from "../../../data/types";
import { inr, parseAmount, plural } from "../../../lib/format";
import { giftTotals } from "../../../shared/balances";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { DraftBox } from "../DraftBox";
import { newId } from "../ids";
import { Section } from "../layout";

const EMPTY_FORM = { from: "", householdId: "", amount: "", item: "" };
type GiftForm = typeof EMPTY_FORM;

/** A thank-you note for one gift, ready to edit and send. */
function thankYou(ev: PersonalEvent, g: Gift): string {
  const what = g.item ? `the lovely ${g.item}` : "your generous blessing";
  return `Dear ${g.from},\nThank you so much for being with us for ${ev.name} and for ${what}. It meant a great deal to the whole family.\nWith love and gratitude`;
}

/** The gift as recorded: from the name typed, or the household picked, with only the parts given. */
function giftFrom(form: GiftForm, households: Household[]): Gift | undefined {
  const h = households.find((x) => x.id === form.householdId);
  const from = form.from.trim() || h?.name;
  if (!from) return undefined;
  const amount = parseAmount(form.amount);
  const item = form.item.trim();
  return {
    id: newId("g"),
    from,
    ...(h ? { householdId: h.id } : {}),
    ...(amount ? { amount } : {}),
    ...(item ? { item } : {}),
  };
}

/** The gift register: who gave what, and who still needs a thank-you. */
export function Gifts({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const gifts = list(ev, "gifts");
  const totals = giftTotals(ev);
  const [adding, setAdding] = useState(false);
  const [thanking, setThanking] = useState<Gift | null>(null);
  const markThanked = (g: Gift, thankNote?: string) =>
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "gifts",
      id: g.id,
      patch: { thanked: true, ...(thankNote ? { thankNote } : {}) },
    });
  const summary = (
    <span className="text-sm text-muted">
      {plural(totals.count, "gift")} · {inr(totals.cash)} · {totals.toThank} to thank
    </span>
  );
  return (
    <Section title="Gifts and shagun" aside={summary}>
      <ul className="m-0 flex list-none flex-col p-0">
        {gifts.map((g) => (
          <GiftRow
            key={g.id}
            g={g}
            editable={editable}
            onThank={() => setThanking(g)}
            onThanked={() => markThanked(g)}
          />
        ))}
        {gifts.length === 0 && (
          <li className="text-sm text-muted">
            Gifts and envelopes go here as they come in, so no one is missed in the thank-yous.
          </li>
        )}
      </ul>
      {editable &&
        (adding ? (
          <AddGift ev={ev} />
        ) : (
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setAdding(true)}>
            + Record a gift
          </button>
        ))}
      <ThankYouDialog
        ev={ev}
        gift={thanking}
        onClose={() => setThanking(null)}
        onSent={(g, text) => {
          markThanked(g, text);
          setThanking(null);
        }}
      />
    </Section>
  );
}

interface RowProps {
  g: Gift;
  editable: boolean;
  onThank: () => void;
  onThanked: () => void;
}

function GiftRow({ g, editable, onThank, onThanked }: RowProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0">
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={onThank}>
              Say thank you
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onThanked}>
              Thanked
            </button>
          </span>
        )
      )}
    </li>
  );
}

function AddGift({ ev }: { ev: PersonalEvent }) {
  const { dispatch } = useStore();
  const households = list(ev, "households");
  const [form, setForm] = useState(EMPTY_FORM);
  const field = bindText(form, setForm);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const record = giftFrom(form, households);
    if (!record) return;
    dispatch({ type: "addRecord", eventId: ev.id, coll: "gifts", record });
    setForm(EMPTY_FORM);
  };
  return (
    <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_1fr_auto] sm:items-end">
      <TextField id="gift-from" label="From" {...field("from")} placeholder="Name" />
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
      <TextField id="gift-amount" label="Cash (₹)" {...field("amount")} inputMode="decimal" />
      <TextField id="gift-item" label="Gift" {...field("item")} placeholder="Silver lamp" />
      <button
        type="submit"
        className="btn btn-primary btn-sm h-10"
        disabled={!form.from.trim() && !form.householdId}
      >
        Add
      </button>
    </form>
  );
}

interface ThankProps {
  ev: PersonalEvent;
  gift: Gift | null;
  onClose: () => void;
  onSent: (g: Gift, text: string) => void;
}

/** A thank-you drafted for one gift, sent on WhatsApp and marked as thanked. */
function ThankYouDialog({ ev, gift, onClose, onSent }: ThankProps) {
  const phone = list(ev, "households").find((h) => h.id === gift?.householdId)?.phone;
  return (
    <Modal open={!!gift} onClose={onClose} title={gift ? `Thank ${gift.from}` : "Thank you"} width={560}>
      {gift && (
        <DraftBox
          task="thanks"
          phone={phone}
          context={{
            event: ev.name,
            from: gift.from,
            gift: gift.item,
            amount: gift.amount ? "a cash gift" : undefined,
          }}
          fallback={thankYou(ev, gift)}
          saveLabel="Mark thanked"
          onSave={(text) => onSent(gift, text)}
        />
      )}
    </Modal>
  );
}
