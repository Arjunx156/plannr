import { type FormEvent, useState } from "react";
import { TextField } from "../../../components/ui";
import { toCsv } from "../../../lib/csv";
import { inr, parseAmount } from "../../../lib/format";
import { CallToAction, SitePage } from "../Layout";
import { useLocal } from "./useLocal";

interface Entry {
  id: string;
  from: string;
  amount: number;
  gift: string;
  side: string;
  thanked: boolean;
}

/** /tools/shagun-register — a gift register kept in this browser, with totals and a CSV export. */
export function ShagunRegister() {
  const [entries, setEntries] = useLocal<Entry[]>("plannr:tool:shagun", []);
  const [form, setForm] = useState({ from: "", amount: "", gift: "", side: "" });
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form.from.trim()) return;
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
    setForm({ from: "", amount: "", gift: "", side: form.side });
  };
  const csv = () => {
    const rows = [
      ["From", "Amount", "Gift", "Side", "Thanked"],
      ...entries.map((e) => [e.from, String(e.amount || ""), e.gift, e.side, e.thanked ? "yes" : "no"]),
    ];
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gift-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <SitePage
      title="Gift and shagun register"
      description="A free gift and shagun register for weddings and functions: write down every envelope and gift as it comes in, total it, and tick off the thank-yous. Download as a spreadsheet."
      eyebrow="Free tool"
      heading="Gift and shagun register"
      lead="Write down every envelope and gift as it comes in. It stays in this browser; download it as a spreadsheet when you're done."
    >
      <form
        onSubmit={add}
        className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1.4fr_1fr_1.2fr_1fr_auto] sm:items-end"
      >
        <TextField
          id="sg-from"
          label="From"
          value={form.from}
          onChange={(from) => setForm({ ...form, from })}
          placeholder="Menon family"
        />
        <TextField
          id="sg-amount"
          label="Amount"
          value={form.amount}
          onChange={(amount) => setForm({ ...form, amount })}
          inputMode="decimal"
          placeholder="1,001"
        />
        <TextField
          id="sg-gift"
          label="Gift"
          value={form.gift}
          onChange={(gift) => setForm({ ...form, gift })}
          placeholder="Silver lamp"
        />
        <TextField
          id="sg-side"
          label="Side"
          value={form.side}
          onChange={(side) => setForm({ ...form, side })}
          placeholder="Bride's side"
        />
        <button type="submit" className="btn btn-primary h-10" disabled={!form.from.trim()}>
          Add
        </button>
      </form>
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={csv}>
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
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2 text-sm first:border-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{e.from}</span>
                <span className="text-xs text-muted">{[e.side, e.gift].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="tabular">{e.amount ? inr(e.amount) : ""}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={e.thanked}
                  onChange={() =>
                    setEntries(entries.map((x) => (x.id === e.id ? { ...x, thanked: !x.thanked } : x)))
                  }
                />
                Thanked
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Remove ${e.from}`}
                onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}
              >
                ✕
              </button>
            </li>
          ))}
          {!entries.length && (
            <li className="text-sm text-muted">Nothing yet. Add the first envelope above.</li>
          )}
        </ul>
      </section>
      <CallToAction label="Keep it with the whole plan" />
    </SitePage>
  );
}
