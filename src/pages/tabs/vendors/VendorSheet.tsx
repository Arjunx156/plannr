import { type FormEvent, useState } from "react";
import { Field, Modal, Pill } from "../../../components/ui";
import type { PlannrEvent, Quote, Vendor } from "../../../data/types";
import type { ReadResult } from "../../../lib/ai";
import { longDate, TODAY } from "../../../lib/dates";
import { inr } from "../../../lib/format";
import { clock, quoteTotal, STAGE_LABEL } from "../../../shared/derive";
import { functionsOf } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { DraftBox, newId, parseAmount, ReadDocument, ShareLink } from "../common";
import { enquiry, guestsOf, STAGE_TONE, STAGES } from "./shared";

/** Adds a vendor or a category still to find. */
export function AddVendor({ ev, onAdd }: { ev: PlannrEvent; onAdd: (v: Vendor) => void }) {
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const [form, setForm] = useState({ category: "", name: "", phone: "", categoryId: "" });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const category = form.category.trim() || cats.find((c) => c.id === form.categoryId)?.name || "";
    if (!category) return;
    onAdd({
      id: newId("v"),
      category,
      name: form.name.trim(),
      stage: form.name.trim() ? "enquired" : "needed",
      quotes: [],
      ...(form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {}),
      ...(form.categoryId ? { categoryId: form.categoryId } : {}),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="What for" htmlFor="v-cat">
        <input
          id="v-cat"
          className="field"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Mehendi artist"
        />
      </Field>
      <Field label="Name" htmlFor="v-name" hint="Leave empty while you're still looking.">
        <input
          id="v-name"
          className="field"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="WhatsApp number" htmlFor="v-phone">
        <input
          id="v-phone"
          className="field"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+91 98470 12345"
        />
      </Field>
      {cats.length > 0 && (
        <Field label="Budget category" htmlFor="v-budget">
          <select
            id="v-budget"
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
      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={!form.category.trim() && !form.categoryId}
      >
        Add
      </button>
    </form>
  );
}

export function VendorSheet({
  ev,
  vendor,
  editable,
  onClose,
  onBook,
}: {
  ev: PlannrEvent;
  vendor: Vendor | undefined;
  editable: boolean;
  onClose: () => void;
  onBook: (v: Vendor, q?: Quote) => void;
}) {
  return (
    <Modal
      open={!!vendor}
      onClose={onClose}
      side="right"
      width={560}
      title={vendor ? vendor.name || vendor.category : "Vendor"}
    >
      {vendor && (
        <VendorDetail
          key={vendor.id}
          ev={ev}
          v={vendor}
          editable={editable}
          onClose={onClose}
          onBook={onBook}
        />
      )}
    </Modal>
  );
}

function VendorDetail({
  ev,
  v,
  editable,
  onClose,
  onBook,
}: {
  ev: PlannrEvent;
  v: Vendor;
  editable: boolean;
  onClose: () => void;
  onBook: (v: Vendor, q?: Quote) => void;
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
  const [quote, setQuote] = useState({ label: "", amount: "", perGuest: false, inclusions: "", terms: "" });
  const [drafting, setDrafting] = useState(false);
  const cats = ev.layout === "personal" ? ev.budget.categories : [];
  const fns = functionsOf(ev);
  const guests = guestsOf(ev);
  const patch = (p: Partial<Vendor>) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "vendors", id: v.id, patch: p });
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
    setQuote({ label: "", amount: "", perGuest: false, inclusions: "", terms: "" });
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
  const arrivals = v.arrivals ?? [];
  const setArrival = (fnId: string, time: string) =>
    patch({
      arrivals: time
        ? [...arrivals.filter((a) => a.fnId !== fnId), { fnId, time }]
        : arrivals.filter((a) => a.fnId !== fnId),
    });

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={STAGE_TONE[v.stage]}>{STAGE_LABEL[v.stage]}</Pill>
        <span className="text-muted">{v.category}</span>
        {v.phone && (
          <a href={`tel:${v.phone}`} className="link ml-auto">
            Call
          </a>
        )}
      </div>

      {editable && v.stage !== "booked" && (
        <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
          <legend className="label mb-1.5">Stage</legend>
          {STAGES.filter((s) => s !== "booked").map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={v.stage === s}
              className="chip chip-sm"
              onClick={() => patch({ stage: s })}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onBook(v, v.quotes.find((q) => q.id === v.chosenQuote) ?? v.quotes[0])}
          >
            Book…
          </button>
        </fieldset>
      )}

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

      {editable && (
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
      )}

      {v.stage === "booked" && (
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
      )}

      {editable ? (
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
      ) : (
        (v.needs || v.notes) && (
          <p className="m-0 text-body">{[v.needs, v.notes].filter(Boolean).join(" · ")}</p>
        )
      )}
    </div>
  );
}
