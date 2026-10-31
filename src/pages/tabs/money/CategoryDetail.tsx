import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { bindText, Field, TextField } from "../../../components/fields";
import { Pill } from "../../../components/ui";
import type { Tone } from "../../../data/baseTypes";
import type { Category, LineItem, PayStatus } from "../../../data/budgetTypes";
import type { PersonalEvent } from "../../../data/types";
import { inr, parseAmount } from "../../../lib/format";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId } from "../ids";

/** Paid lines read as settled, part-paid ones as due; the rest are quiet. */
const PAY_TONE: Partial<Record<PayStatus, Tone>> = { paid: "ok", advance: "due" };
const NO_ITEM = { name: "", vendor: "", amount: "", paid: false };

interface Props {
  ev: PersonalEvent;
  c: Category;
  editable: boolean;
}

/** One budget line opened up: its plan, its items, the vendors on it, and a way to add an item. */
export function CategoryDetail({ ev, c, editable }: Props) {
  const vendors = list(ev, "vendors").filter((v) => v.categoryId === c.id);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sand p-3.5 text-sm">
      {editable && <PlannedField ev={ev} c={c} />}
      {c.note && <span className="text-body">{c.note}</span>}
      <LineItems items={c.items} />
      {vendors.length > 0 && (
        <span className="text-xs text-body">
          Vendors: {vendors.map((v) => v.name || v.category).join(", ")} ·{" "}
          <Link to={`/events/${ev.id}/vendors`} className="link">
            Vendors
          </Link>
        </span>
      )}
      {editable && <AddLineItem ev={ev} c={c} />}
    </div>
  );
}

/** The planned amount, saved on blur or Enter, and a shortcut to adopt the projection as the plan. */
function PlannedField({ ev, c }: Omit<Props, "editable">) {
  const { dispatch } = useStore();
  const [planned, setPlanned] = useState(String(c.planned));
  const { projected } = c;
  const setPlan = (n: number) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "categories", id: c.id, patch: { planned: n } });
  const save = () => {
    const n = parseAmount(planned);
    if (n && n !== c.planned) setPlan(n);
    else setPlanned(String(c.planned));
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Planned" htmlFor={`planned-${c.id}`}>
        <input
          id={`planned-${c.id}`}
          className="field w-36"
          inputMode="decimal"
          value={planned}
          onChange={(e) => setPlanned(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </Field>
      {projected !== undefined && projected !== c.planned && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlan(projected)}>
          Make {inr(projected)} the plan
        </button>
      )}
    </div>
  );
}

function LineItems({ items }: { items: LineItem[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((i) => (
        <li
          key={i.id}
          className="flex flex-wrap items-baseline justify-between gap-2 border-t border-sand-2 py-1.5 first:border-0"
        >
          <span className="flex flex-col">
            <span className="font-medium">{i.name}</span>
            {i.vendor && <span className="text-xs text-muted">{i.vendor}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span className="tabular">{inr(i.amount)}</span>
            <Pill tone={PAY_TONE[i.status] ?? "idle"}>{i.estimate ? "estimate" : i.status}</Pill>
          </span>
        </li>
      ))}
      {items.length === 0 && <li className="text-muted">No line items yet.</li>}
    </ul>
  );
}

/** Adds an item to the line; one marked paid counts towards what's spent. */
function AddLineItem({ ev, c }: Omit<Props, "editable">) {
  const { dispatch } = useStore();
  const [item, setItem] = useState(NO_ITEM);
  const field = bindText(item, setItem);
  const amount = parseAmount(item.amount);
  const name = item.name.trim();
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !amount) return;
    const status = item.paid ? "paid" : "unpaid";
    const line: LineItem = { id: newId("li"), name, vendor: item.vendor.trim(), amount, status };
    dispatch({
      type: "addLineItem",
      eventId: ev.id,
      categoryId: c.id,
      item: line,
      spent: item.paid ? amount : 0,
    });
    setItem(NO_ITEM);
  };
  return (
    <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto_auto] sm:items-end">
      <TextField
        id={`item-${c.id}`}
        label="Item"
        value={item.name}
        onChange={(v) => setItem({ ...item, name: v })}
      />
      <TextField id={`vendor-${c.id}`} label="Paid to" {...field("vendor")} />
      <TextField
        id={`amount-${c.id}`}
        label="Amount"
        value={item.amount}
        onChange={(v) => setItem({ ...item, amount: v })}
        inputMode="decimal"
      />
      <label className="flex h-10 items-center gap-1.5">
        <input
          type="checkbox"
          checked={item.paid}
          onChange={(e) => setItem({ ...item, paid: e.target.checked })}
        />
        Paid
      </label>
      <button type="submit" className="btn btn-secondary btn-sm h-10" disabled={!name || !amount}>
        Add
      </button>
    </form>
  );
}
