import { useState } from "react";
import { TextField } from "../../../components/fields";
import { Modal } from "../../../components/overlays";
import { toneText } from "../../../components/ui";
import type { Category } from "../../../data/budgetTypes";
import type { PersonalEvent } from "../../../data/types";
import { inr, parseAmount } from "../../../lib/format";
import { useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";
import { CategoryDetail } from "./CategoryDetail";

const share = (n: number, max: number) => `${(n / max) * 100}%`;

/** Budget lines: planned, projected and spent, each opening to its items and payments. */
export function Categories({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const cats = ev.budget.categories;
  const max = Math.max(...cats.map((c) => Math.max(c.planned, c.projected ?? 0, c.spent)), 1);
  const add = (name: string, planned: number) => {
    const category: Category = {
      id: newId("c"),
      name,
      planned,
      spent: 0,
      status: "Not started",
      tone: "idle",
      items: [],
    };
    dispatch({ type: "addCategory", eventId: ev.id, category });
    setAdding(false);
  };
  const addButton = editable && (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
      + Category
    </button>
  );
  return (
    <Section title="Where it goes" aside={addButton}>
      <ul className="m-0 flex list-none flex-col p-0">
        {cats.map((c) => (
          <li key={c.id} className="border-t border-sand-2 first:border-0">
            <CategoryRow
              c={c}
              max={max}
              open={open === c.id}
              onToggle={() => setOpen(open === c.id ? null : c.id)}
            />
            {open === c.id && <CategoryDetail ev={ev} c={c} editable={editable} />}
          </li>
        ))}
      </ul>
      <span className="text-xs text-muted">{ev.budget.source}</span>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a category">
        <AddCategory onAdd={add} />
      </Modal>
    </Section>
  );
}

interface RowProps {
  c: Category;
  /** The largest amount on any line, so every bar shares one scale. */
  max: number;
  open: boolean;
  onToggle: () => void;
}

function CategoryRow({ c, max, open, onToggle }: RowProps) {
  const proj = c.projected ?? c.planned;
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 text-left sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]"
    >
      <span className="font-medium">{c.name}</span>
      <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
        <SpendBar c={c} max={max} />
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
  );
}

/** The plan in grey, spending over it (rust once the line is heading over), and the overrun shaded past it. */
function SpendBar({ c, max }: { c: Category; max: number }) {
  const proj = c.projected ?? c.planned;
  const over = proj > c.planned;
  return (
    <span className="relative block h-2 rounded-[2px] bg-sand-2">
      <span
        className="absolute inset-y-0 left-0 rounded-[2px] bg-line-2"
        style={{ width: share(c.planned, max) }}
      />
      <span
        className="absolute inset-y-0 left-0 rounded-[2px]"
        style={{ width: share(c.spent, max), background: over ? "var(--color-rust)" : "var(--color-leaf)" }}
      />
      {over && (
        <span
          className="absolute inset-y-0 rounded-r-[2px] bg-rust opacity-40"
          style={{ left: share(c.planned, max), width: share(proj - c.planned, max) }}
        />
      )}
    </span>
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
      <TextField id="cat-name" label="Name" value={name} onChange={setName} placeholder="Mehendi artist" />
      <TextField
        id="cat-amount"
        label="Planned (₹)"
        hint="2,40,000 or 2.4L both work"
        value={amount}
        onChange={setAmount}
        inputMode="decimal"
      />
      <button type="submit" className="btn btn-primary self-start" disabled={!name.trim()}>
        Add {planned ? inr(planned) : ""}
      </button>
    </form>
  );
}
