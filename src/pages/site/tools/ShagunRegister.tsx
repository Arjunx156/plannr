import { type FormEvent, useState } from "react";
import { bindText, TextField } from "../../../components/fields";
import { toCsv } from "../../../lib/csv";
import { download } from "../../../lib/download";
import { inr, parseAmount } from "../../../lib/format";
import { CallToAction, SitePage } from "../siteLayout";
import { useLocal } from "./useLocal";

interface Entry {
  id: string;
  from: string;
  amount: number;
  gift: string;
  side: string;
  thanked: boolean;
}

const EMPTY_FORM = { from: "", amount: "", gift: "", side: "" };
type EntryForm = typeof EMPTY_FORM;

function downloadRegister(entries: Entry[]) {
  const rows = [
    ["From", "Amount", "Gift", "Side", "Thanked"],
    ...entries.map((e) => [e.from, String(e.amount || ""), e.gift, e.side, e.thanked ? "yes" : "no"]),
  ];
  download("gift-register.csv", toCsv(rows), "text/csv");
}

/** /tools/shagun-register — a gift register kept in this browser, with totals and a CSV export. */
export function ShagunRegister() {
  const [entries, setEntries] = useLocal<Entry[]>("plannr:tool:shagun", []);
  const add = (form: EntryForm) =>
    setEntries([
      ...entries,
      {
        id: `${Date.now().toString(36)}${entries.length}`,
        from: form.from.trim(),
        amount: parseAmount(form.amount),
        gift: form.gift.trim(),
        side: form.side.trim(),
        thanked: false,
      },
    ]);
  const toggle = (id: string) =>
    setEntries(entries.map((x) => (x.id === id ? { ...x, thanked: !x.thanked } : x)));
  const remove = (id: string) => setEntries(entries.filter((x) => x.id !== id));
  return (
    <SitePage
      title="Gift and shagun register"
      description="A free gift and shagun register for weddings and functions: write down every envelope and gift as it comes in, total it, and tick off the thank-yous. Download as a spreadsheet."
      eyebrow="Free tool"
      heading="Gift and shagun register"
      lead="Write down every envelope and gift as it comes in. It stays in this browser; download it as a spreadsheet when you're done."
    >
      <AddEntry onAdd={add} />
      <Register entries={entries} onToggle={toggle} onRemove={remove} />
      <CallToAction label="Keep it with the whole plan" />
    </SitePage>
  );
}

/** The entry form. The side stays filled after adding, since envelopes come in runs from one side. */
function AddEntry({ onAdd }: { onAdd: (form: EntryForm) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const field = bindText(form, setForm);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.from.trim()) return;
    onAdd(form);
    setForm({ ...EMPTY_FORM, side: form.side });
  };
  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1.4fr_1fr_1.2fr_1fr_auto] sm:items-end"
    >
      <TextField id="sg-from" label="From" {...field("from")} placeholder="Menon family" />
      <TextField id="sg-amount" label="Amount" {...field("amount")} inputMode="decimal" placeholder="1,001" />
      <TextField id="sg-gift" label="Gift" {...field("gift")} placeholder="Silver lamp" />
      <TextField id="sg-side" label="Side" {...field("side")} placeholder="Bride's side" />
      <button type="submit" className="btn btn-primary h-10" disabled={!form.from.trim()}>
        Add
      </button>
    </form>
  );
}

interface RegisterProps {
  entries: Entry[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function Register({ entries, onToggle, onRemove }: RegisterProps) {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return (
    <section
      aria-label="Register"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-[26px] leading-tight">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} · {inr(total)}
        </h2>
        {entries.length > 0 && (
          <span className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => downloadRegister(entries)}
            >
              Download spreadsheet
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              Print
            </button>
          </span>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {entries.map((e) => (
          <EntryRow key={e.id} e={e} onToggle={() => onToggle(e.id)} onRemove={() => onRemove(e.id)} />
        ))}
        {entries.length === 0 && (
          <li className="text-sm text-muted">Nothing yet. Add the first envelope above.</li>
        )}
      </ul>
    </section>
  );
}

function EntryRow({ e, onToggle, onRemove }: { e: Entry; onToggle: () => void; onRemove: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2 text-sm first:border-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{e.from}</span>
        <span className="text-xs text-muted">{[e.side, e.gift].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="tabular">{e.amount ? inr(e.amount) : ""}</span>
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={e.thanked} onChange={onToggle} />
        Thanked
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-label={`Remove ${e.from}`}
        onClick={onRemove}
      >
        ✕
      </button>
    </li>
  );
}
