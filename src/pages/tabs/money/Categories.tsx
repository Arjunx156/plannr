import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { Field, Modal, Pill, toneText } from "../../../components/ui";
import type { Category, PersonalEvent } from "../../../data/types";
import { inr } from "../../../lib/format";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId, parseAmount, Section } from "../common";

/** Budget lines: planned, projected and spent, with each line's items and payments. */
export function Categories({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const max = Math.max(...ev.budget.categories.map((c) => Math.max(c.planned, c.projected ?? 0, c.spent)), 1);
  return (
    <Section
      title="Where it goes"
      aside={
        editable && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            + Category
          </button>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {ev.budget.categories.map((c) => {
          const proj = c.projected ?? c.planned;
          const isOpen = open === c.id;
          return (
            <li key={c.id} className="border-t border-sand-2 first:border-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : c.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 text-left sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]"
              >
                <span className="font-medium">{c.name}</span>
                <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                  <span className="relative block h-2 rounded-[2px] bg-sand-2">
                    <span
                      className="absolute inset-y-0 left-0 rounded-[2px] bg-line-2"
                      style={{ width: `${(c.planned / max) * 100}%` }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-[2px]"
                      style={{
                        width: `${(c.spent / max) * 100}%`,
                        background: proj > c.planned ? "var(--color-rust)" : "var(--color-leaf)",
                      }}
                    />
                    {proj > c.planned && (
                      <span
                        className="absolute inset-y-0 rounded-r-[2px] bg-rust opacity-40"
                        style={{
                          left: `${(c.planned / max) * 100}%`,
                          width: `${((proj - c.planned) / max) * 100}%`,
                        }}
                      />
                    )}
                  </span>
                </span>
                <span className="flex flex-col items-end text-sm tabular">
                  <span>
                    {inr(c.spent)} <span className="text-muted">/ {inr(c.planned)}</span>
                  </span>
                  <span className={`text-xs ${proj > c.planned ? "text-rust-ink" : toneText(c.tone)}`}>
                    {proj !== c.planned ? `heading for ${inr(proj)}` : c.status}
                  </span>
                </span>
              </button>
              {isOpen && <CategoryDetail ev={ev} c={c} editable={editable} />}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">{ev.budget.source}</span>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a category">
        <AddCategory
          onAdd={(name, planned) => {
            dispatch({
              type: "addCategory",
              eventId: ev.id,
              category: {
                id: newId("c"),
                name,
                planned,
                spent: 0,
                status: "Not started",
                tone: "idle",
                items: [],
              },
            });
            setAdding(false);
          }}
        />
      </Modal>
    </Section>
  );
}

function AddCategory({ onAdd }: { onAdd: (name: string, planned: number) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const planned = parseAmount(amount);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onAdd(name.trim(), planned);
      }}
    >
      <Field label="Name" htmlFor="cat-name">
        <input
          id="cat-name"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mehendi artist"
        />
      </Field>
      <Field label="Planned (₹)" htmlFor="cat-amount" hint="2,40,000 or 2.4L both work">
        <input
          id="cat-amount"
          className="field"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <button type="submit" className="btn btn-primary self-start" disabled={!name.trim()}>
        Add {planned ? inr(planned) : ""}
      </button>
    </form>
  );
}

function CategoryDetail({ ev, c, editable }: { ev: PersonalEvent; c: Category; editable: boolean }) {
  const { dispatch } = useStore();
  const [planned, setPlanned] = useState(String(c.planned));
  const [item, setItem] = useState({ name: "", vendor: "", amount: "", paid: false });
  const vendors = list(ev, "vendors").filter((v) => v.categoryId === c.id);
  const savePlanned = () => {
    const n = parseAmount(planned);
    if (n && n !== c.planned)
      dispatch({ type: "updateRecord", eventId: ev.id, coll: "categories", id: c.id, patch: { planned: n } });
    else setPlanned(String(c.planned));
  };
  const addItem = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(item.amount);
    if (!item.name.trim() || !amount) return;
    dispatch({
      type: "addLineItem",
      eventId: ev.id,
      categoryId: c.id,
      item: {
        id: newId("li"),
        name: item.name.trim(),
        vendor: item.vendor.trim(),
        amount,
        status: item.paid ? "paid" : "unpaid",
      },
      spent: item.paid ? amount : 0,
    });
    setItem({ name: "", vendor: "", amount: "", paid: false });
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sand p-3.5 text-sm">
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Planned" htmlFor={`planned-${c.id}`}>
            <input
              id={`planned-${c.id}`}
              className="field w-36"
              inputMode="decimal"
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
              onBlur={savePlanned}
              onKeyDown={(e) => e.key === "Enter" && savePlanned()}
            />
          </Field>
          {c.projected !== undefined && c.projected !== c.planned && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                dispatch({
                  type: "updateRecord",
                  eventId: ev.id,
                  coll: "categories",
                  id: c.id,
                  patch: { planned: c.projected },
                })
              }
            >
              Make {inr(c.projected)} the plan
            </button>
          )}
        </div>
      )}
      {c.note && <span className="text-body">{c.note}</span>}
      <ul className="m-0 flex list-none flex-col p-0">
        {c.items.map((i) => (
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
              <Pill tone={i.status === "paid" ? "ok" : i.status === "advance" ? "due" : "idle"}>
                {i.estimate ? "estimate" : i.status}
              </Pill>
            </span>
          </li>
        ))}
        {!c.items.length && <li className="text-muted">No line items yet.</li>}
      </ul>
      {vendors.length > 0 && (
        <span className="text-xs text-body">
          Vendors: {vendors.map((v) => v.name || v.category).join(", ")} ·{" "}
          <Link to={`/events/${ev.id}/vendors`} className="link">
            Vendors
          </Link>
        </span>
      )}
      {editable && (
        <form onSubmit={addItem} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto_auto] sm:items-end">
          <Field label="Item" htmlFor={`item-${c.id}`}>
            <input
              id={`item-${c.id}`}
              className="field"
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </Field>
          <Field label="Paid to" htmlFor={`vendor-${c.id}`}>
            <input
              id={`vendor-${c.id}`}
              className="field"
              value={item.vendor}
              onChange={(e) => setItem({ ...item, vendor: e.target.value })}
            />
          </Field>
          <Field label="Amount" htmlFor={`amount-${c.id}`}>
            <input
              id={`amount-${c.id}`}
              className="field"
              inputMode="decimal"
              value={item.amount}
              onChange={(e) => setItem({ ...item, amount: e.target.value })}
            />
          </Field>
          <label className="flex h-10 items-center gap-1.5">
            <input
              type="checkbox"
              checked={item.paid}
              onChange={(e) => setItem({ ...item, paid: e.target.checked })}
            />
            Paid
          </label>
          <button
            type="submit"
            className="btn btn-secondary btn-sm h-10"
            disabled={!item.name.trim() || !parseAmount(item.amount)}
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
