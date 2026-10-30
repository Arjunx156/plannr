import { type FormEvent, useState } from "react";
import { Field, Pill } from "../../../components/ui";
import type { PlannrEvent, Quote, Vendor } from "../../../data/types";
import type { ReadResult } from "../../../lib/ai";
import { longDate, TODAY } from "../../../lib/dates";
import { inr } from "../../../lib/format";
import { clock, quoteTotal } from "../../../shared/derive";
import { functionsOf } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { DraftBox, newId, parseAmount, ReadDocument, ShareLink } from "../common";
import { enquiry, guestsOf } from "./shared";

/** Changes some fields of one vendor. */
export type PatchVendor = (p: Partial<Vendor>) => void;

const NO_QUOTE = { label: "", amount: "", perGuest: false, inclusions: "", terms: "" };

/** The vendor's quotes, totalled for this guest count, with a form to add one or read one from a photo. */
export function Quotes({
  ev,
  v,
  editable,
  patch,
  onBook,
}: {
  ev: PlannrEvent;
  v: Vendor;
  editable: boolean;
  patch: PatchVendor;
  onBook: (v: Vendor, q?: Quote) => void;
}) {
  const { dispatch } = useStore();
  const [quote, setQuote] = useState(NO_QUOTE);
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const guests = guestsOf(ev);
  const addQuote = (q: Omit<Quote, "id">) =>
    patch({
      quotes: [...v.quotes, { id: newId("q"), on: TODAY, ...q }],
      ...(v.stage === "needed" || v.stage === "enquired" ? { stage: "quoted" as const } : {}),
    });
  const submitQuote = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(quote.amount);
    if (!amount) return;
    addQuote({
      label: quote.label.trim() || `${v.name || v.category} quote`,
      amount,
      ...(quote.perGuest ? { perGuest: true } : {}),
      ...(quote.inclusions.trim() ? { inclusions: quote.inclusions.trim() } : {}),
      ...(quote.terms.trim() ? { terms: quote.terms.trim() } : {}),
    });
    setQuote(NO_QUOTE);
  };
  const fromDocument = (r: ReadResult) => {
    const amount = r.total ?? r.items.reduce((s, i) => s + i.amount, 0);
    if (!amount) {
      dispatch(toast("Plannr couldn't find an amount in that document."));
      return;
    }
    addQuote({
      label: `${r.vendor || v.name || v.category}${r.summary ? ` · ${r.summary}` : ""}`,
      amount,
      source: "document",
      ...(r.perGuest ? { perGuest: true } : {}),
      ...(r.inclusions ? { inclusions: r.inclusions } : {}),
      ...(r.terms || r.payments.length
        ? {
            terms: [r.terms, r.payments.map((p) => `${p.label} ${inr(p.amount)}`).join(", ")]
              .filter(Boolean)
              .join(" · "),
          }
        : {}),
    });
    if (r.vendor && !v.name) patch({ name: r.vendor });
    dispatch(
      toast(`Added the quote: ${inr(amount)}${r.perGuest ? " a plate" : ""}. Check it against the paper.`),
    );
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
          <li key={q.id} className="flex flex-col gap-0.5 border-t border-sand-2 py-2 first:border-0">
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
              {v.chosenQuote === q.id && <Pill tone="ok">chosen</Pill>}
              {editable && v.stage !== "booked" && (
                <button type="button" className="link text-xs" onClick={() => onBook(v, q)}>
                  Book at this price
                </button>
              )}
              {editable && (
                <button
                  type="button"
                  className="link text-xs text-muted"
                  onClick={() => patch({ quotes: v.quotes.filter((x) => x.id !== q.id) })}
                >
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
        {!v.quotes.length && <li className="text-muted">No quotes yet.</li>}
      </ul>
      {editable && (
        <form onSubmit={submitQuote} className="flex flex-col gap-2 rounded-xl bg-sand p-3">
          <div className="grid grid-cols-[1fr_130px] gap-2">
            <Field label="Package" htmlFor="q-label">
              <input
                id="q-label"
                className="field"
                value={quote.label}
                onChange={(e) => setQuote({ ...quote, label: e.target.value })}
                placeholder="Gold package"
              />
            </Field>
            <Field label="Amount (₹)" htmlFor="q-amount">
              <input
                id="q-amount"
                className="field"
                inputMode="decimal"
                value={quote.amount}
                onChange={(e) => setQuote({ ...quote, amount: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={quote.perGuest}
              onChange={(e) => setQuote({ ...quote, perGuest: e.target.checked })}
            />
            Per plate or per guest
          </label>
          <Field label="Includes" htmlFor="q-inc">
            <input
              id="q-inc"
              className="field"
              value={quote.inclusions}
              onChange={(e) => setQuote({ ...quote, inclusions: e.target.value })}
              placeholder="Sadya on banana leaf, payasam ×2, service staff"
            />
          </Field>
          <Field label="Terms" htmlFor="q-terms">
            <input
              id="q-terms"
              className="field"
              value={quote.terms}
              onChange={(e) => setQuote({ ...quote, terms: e.target.value })}
              placeholder="30% advance, balance a week before"
            />
          </Field>
          <button
            type="submit"
            className="btn btn-secondary btn-sm self-start"
            disabled={!parseAmount(quote.amount)}
          >
            Add quote
          </button>
        </form>
      )}
    </section>
  );
}

/** Drafts the enquiry message, in the vendor's language when they have one. */
export function AskForQuote({ ev, v, patch }: { ev: PlannrEvent; v: Vendor; patch: PatchVendor }) {
  const [drafting, setDrafting] = useState(false);
  const fns = functionsOf(ev);
  const guests = guestsOf(ev);
  return (
    <section aria-label="Ask for a quote" className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <h3 className="font-semibold">Ask for a quote</h3>
        {!drafting && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafting(true)}>
            Draft a message
          </button>
        )}
      </span>
      {drafting && (
        <DraftBox
          task="enquiry"
          phone={v.phone}
          lang={v.lang}
          context={{
            event: ev.name,
            category: v.category,
            vendor: v.name,
            date: ev.date,
            guests,
            functions: fns.map((f) => `${f.label} ${f.date}`),
          }}
          fallback={enquiry(ev, v)}
          saveLabel="Mark enquired"
          onSave={() => {
            if (v.stage === "needed") patch({ stage: "enquired" });
            setDrafting(false);
          }}
        />
      )}
    </section>
  );
}

/** When a booked vendor arrives for each function, and the call sheet that tells them. */
export function OnTheDay({
  ev,
  v,
  editable,
  patch,
}: {
  ev: PlannrEvent;
  v: Vendor;
  editable: boolean;
  patch: PatchVendor;
}) {
  const fns = functionsOf(ev);
  const arrivals = v.arrivals ?? [];
  const setArrival = (fnId: string, time: string) =>
    patch({
      arrivals: time
        ? [...arrivals.filter((a) => a.fnId !== fnId), { fnId, time }]
        : arrivals.filter((a) => a.fnId !== fnId),
    });
  return (
    <section aria-label="On the day" className="flex flex-col gap-2">
      <h3 className="font-semibold">On the day</h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {fns.map((f) => {
          const a = arrivals.find((x) => x.fnId === f.id);
          return (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <label htmlFor={`arr-${f.id}`}>
                {f.label} <span className="text-muted">· {longDate(f.date)}</span>
              </label>
              {editable ? (
                <input
                  id={`arr-${f.id}`}
                  type="time"
                  className="field h-8 w-32"
                  value={a?.time ?? ""}
                  onChange={(e) => setArrival(f.id, e.target.value)}
                />
              ) : (
                <span>{a ? clock(a.time) : "—"}</span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">
        Their call sheet shows when to arrive, the run sheet, what they need and what's been paid. Nothing
        else.
      </span>
      <ShareLink
        ev={ev}
        kind="vendor"
        target={v.id}
        phone={v.phone}
        label="Send call sheet"
        message={`Namaste${v.contact ? ` ${v.contact}` : ""}, here's the call sheet for ${ev.name}: timings, the plan for the day and payments.`}
      />
    </section>
  );
}

/** Name, contact, payment and day-of details, and removing the vendor. */
export function VendorDetails({
  ev,
  v,
  patch,
  onClose,
}: {
  ev: PlannrEvent;
  v: Vendor;
  patch: PatchVendor;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState({
    name: v.name,
    phone: v.phone ?? "",
    upi: v.upi ?? "",
    contact: v.contact ?? "",
    needs: v.needs ?? "",
    notes: v.notes ?? "",
    categoryId: v.categoryId ?? "",
  });
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const save = (e: FormEvent) => {
    e.preventDefault();
    patch({
      name: form.name.trim(),
      phone: form.phone.replace(/[^\d+]/g, "") || undefined,
      upi: form.upi.trim() || undefined,
      contact: form.contact.trim() || undefined,
      needs: form.needs.trim() || undefined,
      notes: form.notes.trim() || undefined,
      categoryId: form.categoryId || undefined,
      ...(v.stage === "needed" && form.name.trim() ? { stage: "enquired" as const } : {}),
    });
    dispatch(toast("Saved."));
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 className="font-semibold">Details</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="vd-name">
          <input
            id="vd-name"
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Contact person" htmlFor="vd-contact">
          <input
            id="vd-contact"
            className="field"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
        </Field>
        <Field label="WhatsApp number" htmlFor="vd-phone">
          <input
            id="vd-phone"
            className="field"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="UPI id" htmlFor="vd-upi" hint="For paying them from the budget">
          <input
            id="vd-upi"
            className="field"
            value={form.upi}
            onChange={(e) => setForm({ ...form, upi: e.target.value })}
            placeholder="name@okhdfc"
          />
        </Field>
      </div>
      {cats.length > 0 && (
        <Field label="Budget category" htmlFor="vd-cat">
          <select
            id="vd-cat"
            className="field"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">None</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="What they need on the day" htmlFor="vd-needs">
        <input
          id="vd-needs"
          className="field"
          value={form.needs}
          onChange={(e) => setForm({ ...form, needs: e.target.value })}
          placeholder="Two power points, a table near the stage"
        />
      </Field>
      <Field label="Notes" htmlFor="vd-notes">
        <textarea
          id="vd-notes"
          className="field min-h-16 py-2"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <span className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (!window.confirm(`Remove ${v.name || v.category}? Their quotes go with them.`)) return;
            dispatch({ type: "removeRecord", eventId: ev.id, coll: "vendors", id: v.id });
            onClose();
          }}
        >
          Remove vendor
        </button>
      </span>
    </form>
  );
}
