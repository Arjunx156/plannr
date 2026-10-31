import { type FormEvent, useState } from "react";
import { bindText, TextField } from "../../../components/fields";
import { Pill } from "../../../components/ui";
import type { PlannrEvent } from "../../../data/types";
import type { Quote, Vendor } from "../../../data/vendorTypes";
import type { ReadResult } from "../../../lib/ai";
import { TODAY } from "../../../lib/dates";
import { inr, parseAmount } from "../../../lib/format";
import { quoteTotal } from "../../../shared/derive";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";
import { ReadDocument } from "../ReadDocument";
import { guestsOf } from "./shared";
import type { PatchVendor } from "./vendorDetails";

const NO_QUOTE = { label: "", amount: "", perGuest: false, inclusions: "", terms: "" };
type NewQuote = Omit<Quote, "id">;

/** A typed quote: package name (or "<vendor> quote"), amount, and whatever else was filled in. */
function quoteFromForm(form: typeof NO_QUOTE, v: Vendor): NewQuote | undefined {
  const amount = parseAmount(form.amount);
  if (!amount) return undefined;
  const inclusions = form.inclusions.trim();
  const terms = form.terms.trim();
  return {
    label: form.label.trim() || `${v.name || v.category} quote`,
    amount,
    ...(form.perGuest && { perGuest: true }),
    ...(inclusions && { inclusions }),
    ...(terms && { terms }),
  };
}

/** A quote read from a photo or PDF; its instalments are folded into the terms. */
function quoteFromDocument(r: ReadResult, v: Vendor): NewQuote | undefined {
  const amount = r.total ?? r.items.reduce((s, i) => s + i.amount, 0);
  if (!amount) return undefined;
  const instalments = r.payments.map((p) => `${p.label} ${inr(p.amount)}`).join(", ");
  const terms = [r.terms, instalments].filter(Boolean).join(" · ");
  return {
    label: `${r.vendor || v.name || v.category}${r.summary ? ` · ${r.summary}` : ""}`,
    amount,
    source: "document",
    ...(r.perGuest && { perGuest: true }),
    ...(r.inclusions && { inclusions: r.inclusions }),
    ...(terms && { terms }),
  };
}

/** One quote with its per-plate total, and booking at it or removing it. */
function QuoteItem({
  quote: q,
  guests,
  chosen,
  editable,
  bookable,
  onBook,
  onRemove,
}: {
  quote: Quote;
  guests: number;
  chosen: boolean;
  editable: boolean;
  bookable: boolean;
  onBook: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-0.5 border-t border-sand-2 py-2 first:border-0">
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{q.label}</span>
        <span className="tabular font-semibold">
          {inr(q.amount)}
          {q.perGuest ? ` a plate · ${inr(quoteTotal(q.amount, true, guests))} for ${guests}` : ""}
        </span>
      </span>
      {q.inclusions && <span className="text-xs text-body">Includes: {q.inclusions}</span>}
      {q.terms && <span className="text-xs text-body">Terms: {q.terms}</span>}
      <span className="flex items-center gap-2">
        {chosen && <Pill tone="ok">chosen</Pill>}
        {editable && bookable && (
          <button type="button" className="link text-xs" onClick={onBook}>
            Book at this price
          </button>
        )}
        {editable && (
          <button type="button" className="link text-xs text-muted" onClick={onRemove}>
            Remove
          </button>
        )}
      </span>
    </li>
  );
}
interface QuotesProps {
  ev: PlannrEvent;
  v: Vendor;
  editable: boolean;
  patch: PatchVendor;
  onBook: (v: Vendor, q?: Quote) => void;
}

/** The vendor's quotes, totalled for this guest count, with a form to add one or read one from a photo. */
export function Quotes({ ev, v, editable, patch, onBook }: QuotesProps) {
  const { dispatch } = useStore();
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const guests = guestsOf(ev);
  // A first quote moves a vendor still being looked for, or asked, on to "quoted".
  const addQuote = (q: NewQuote) =>
    patch({
      quotes: [...v.quotes, { id: newId("q"), on: TODAY, ...q }],
      ...(v.stage === "needed" || v.stage === "enquired" ? { stage: "quoted" as const } : {}),
    });
  const fromDocument = (r: ReadResult) => {
    const read = quoteFromDocument(r, v);
    if (!read) {
      dispatch(toast("Plannr couldn't find an amount in that document."));
      return;
    }
    addQuote(read);
    if (r.vendor && !v.name) patch({ name: r.vendor });
    const each = r.perGuest ? " a plate" : "";
    dispatch(toast(`Added the quote: ${inr(read.amount)}${each}. Check it against the paper.`));
  };
  return (
    <section aria-label="Quotes" className="flex flex-col gap-2">
      <span className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Quotes</h3>
        {editable && (
          <ReadDocument
            label="Read a quote"
            categories={cats.map((c) => c.name)}
            guests={guests}
            onRead={fromDocument}
          />
        )}
      </span>
      <ul className="m-0 flex list-none flex-col p-0">
        {v.quotes.map((q) => (
          <QuoteItem
            key={q.id}
            quote={q}
            guests={guests}
            chosen={v.chosenQuote === q.id}
            editable={editable}
            bookable={v.stage !== "booked"}
            onBook={() => onBook(v, q)}
            onRemove={() => patch({ quotes: v.quotes.filter((x) => x.id !== q.id) })}
          />
        ))}
        {v.quotes.length === 0 && <li className="text-muted">No quotes yet.</li>}
      </ul>
      {editable && <QuoteForm v={v} onAdd={addQuote} />}
    </section>
  );
}

function QuoteForm({ v, onAdd }: { v: Vendor; onAdd: (q: NewQuote) => void }) {
  const [quote, setQuote] = useState(NO_QUOTE);
  const field = bindText(quote, setQuote);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const typed = quoteFromForm(quote, v);
    if (!typed) return;
    onAdd(typed);
    setQuote(NO_QUOTE);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl bg-sand p-3">
      <div className="grid grid-cols-[1fr_130px] gap-2">
        <TextField id="q-label" label="Package" {...field("label")} placeholder="Gold package" />
        <TextField id="q-amount" label="Amount (₹)" {...field("amount")} inputMode="decimal" />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={quote.perGuest}
          onChange={(e) => setQuote({ ...quote, perGuest: e.target.checked })}
        />
        Per plate or per guest
      </label>
      <TextField
        id="q-inc"
        label="Includes"
        {...field("inclusions")}
        placeholder="Sadya on banana leaf, payasam ×2, service staff"
      />
      <TextField
        id="q-terms"
        label="Terms"
        {...field("terms")}
        placeholder="30% advance, balance a week before"
      />
      <button
        type="submit"
        className="btn btn-secondary btn-sm self-start"
        disabled={!parseAmount(quote.amount)}
      >
        Add quote
      </button>
    </form>
  );
}
