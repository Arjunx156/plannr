import { type FormEvent, useState } from "react";
import { RippleDialog } from "../../components/ripple";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill } from "../../components/ui";
import type { PlannrEvent, Quote, Vendor, VendorStage } from "../../data/types";
import type { ReadResult } from "../../lib/ai";
import { longDate, TODAY } from "../../lib/dates";
import { inr, plural } from "../../lib/format";
import { clock, quoteTotal, STAGE_LABEL } from "../../shared/derive";
import { functionsOf, list } from "../../shared/records";
import { bookingRipple, type Ripple } from "../../shared/ripple";
import { toast, useStore } from "../../store/store";
import { DraftBox, newId, parseAmount, ReadDocument, Section, ShareLink, Stat, TabPage } from "./common";

const STAGES: VendorStage[] = ["needed", "enquired", "quoted", "booked"];
const STAGE_TONE: Record<VendorStage, "idle" | "due" | "ok"> = {
  needed: "idle",
  enquired: "due",
  quoted: "due",
  booked: "ok",
};

function guestsOf(ev: PlannrEvent): number {
  return ev.layout === "personal" ? ev.guests : 0;
}

function bestQuote(ev: PlannrEvent, v: Vendor): { q: Quote; total: number } | undefined {
  const guests = guestsOf(ev);
  const chosen = v.quotes.find((q) => q.id === v.chosenQuote);
  const pick =
    chosen ??
    [...v.quotes].sort(
      (a, b) => quoteTotal(a.amount, a.perGuest, guests) - quoteTotal(b.amount, b.perGuest, guests),
    )[0];
  return pick ? { q: pick, total: quoteTotal(pick.amount, pick.perGuest, guests) } : undefined;
}

function enquiry(ev: PlannrEvent, v: Vendor): string {
  const fns = functionsOf(ev);
  const when =
    fns.length > 1
      ? `${fns.map((f) => f.label).join(", ")} (from ${longDate(fns[0]?.date ?? ev.date)})`
      : longDate(ev.date);
  const guests = guestsOf(ev);
  return `Namaste${v.contact ? ` ${v.contact}` : ""}, we're planning ${ev.name}: ${when}${guests ? `, about ${guests} guests` : ""}. Could you share your availability, packages and rates for ${v.category.toLowerCase()}? Thank you.`;
}

/** /events/:id/vendors — who's booked, who's quoted, and the comparison that picks between them. */
export function VendorsTab({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const vendors = list(ev, "vendors");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const booked = vendors.filter((v) => v.stage === "booked");
  const categories = [...new Set(vendors.map((v) => v.category))];
  // Worth comparing: a category with more than one quote, from one shortlist or several vendors.
  const comparable = categories.filter(
    (c) => vendors.filter((v) => v.category === c).reduce((n, v) => n + v.quotes.length, 0) > 1,
  );
  const current = vendors.find((v) => v.id === open);
  const committed = booked.reduce((s, v) => s + (bestQuote(ev, v)?.total ?? 0), 0);

  return (
    <TabPage
      eyebrow={ev.name}
      title="Vendors"
      wide
      aside={
        editable && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add a vendor
          </button>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAGES.map((s) => (
          <Stat
            key={s}
            label={STAGE_LABEL[s]}
            value={vendors.filter((v) => v.stage === s).length}
            sub={
              s === "booked" && committed
                ? `${inr(committed)} committed`
                : vendors
                    .filter((v) => v.stage === s)
                    .map((v) => v.category)
                    .slice(0, 3)
                    .join(", ") || "—"
            }
            tone={s === "booked" ? "text-leaf-ink" : undefined}
          />
        ))}
      </div>

      {comparable.map((c) => (
        <Compare
          key={c}
          ev={ev}
          category={c}
          editable={editable}
          onBook={(v, q) => setRipple(bookingRipple(ev, v.id, q.id))}
          onOpen={setOpen}
        />
      ))}

      <div className="grid gap-4 lg:grid-cols-4">
        {STAGES.map((stage) => {
          const items = vendors.filter((v) => v.stage === stage);
          return (
            <section
              key={stage}
              aria-label={STAGE_LABEL[stage]}
              className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5"
            >
              <h2 className="eyebrow text-muted">
                {STAGE_LABEL[stage]} · {items.length}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((v) => {
                  const b = bestQuote(ev, v);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(v.id)}
                        className="flex w-full flex-col gap-0.5 rounded-xl bg-sand p-3 text-left text-sm hover:bg-sand-2"
                      >
                        <span className="font-semibold">{v.category}</span>
                        <span className="text-body">{v.name || "Still looking"}</span>
                        {b && (
                          <span className="text-xs tabular text-muted">
                            {inr(b.total)}
                            {b.q.perGuest ? ` · ${inr(b.q.amount)} a plate` : ""}
                            {v.quotes.length > 1 ? ` · ${v.quotes.length} quotes` : ""}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {!items.length && <li className="text-xs text-muted">None</li>}
              </ul>
            </section>
          );
        })}
      </div>

      <VendorSheet
        ev={ev}
        vendor={current}
        editable={editable}
        onClose={() => setOpen(null)}
        onBook={(v, q) => setRipple(bookingRipple(ev, v.id, q?.id))}
      />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a vendor">
        <AddVendor
          ev={ev}
          onAdd={(v) => {
            dispatch({ type: "addRecord", eventId: ev.id, coll: "vendors", record: v });
            setAdding(false);
            setOpen(v.id);
          }}
        />
      </Modal>
      <RippleDialog ripple={ripple} onClose={() => setRipple(null)} />
    </TabPage>
  );
}

function Compare({
  ev,
  category,
  editable,
  onBook,
  onOpen,
}: {
  ev: PlannrEvent;
  category: string;
  editable: boolean;
  onBook: (v: Vendor, q: Quote) => void;
  onOpen: (id: string) => void;
}) {
  const guests = guestsOf(ev);
  const rows = list(ev, "vendors")
    .filter((v) => v.category === category)
    .flatMap((v) => v.quotes.map((q) => ({ v, b: { q, total: quoteTotal(q.amount, q.perGuest, guests) } })))
    .sort((a, b) => a.b.total - b.b.total);
  const cheapest = rows[0]?.b.total ?? 0;
  const booked = rows.find(
    (r) => r.v.stage === "booked" && (!r.v.chosenQuote || r.v.chosenQuote === r.b.q.id),
  );
  return (
    <Section
      title={`${category}: side by side`}
      aside={
        booked ? (
          <Pill tone="ok">booked {booked.v.name || booked.b.q.label}</Pill>
        ) : (
          <span className="text-sm text-muted">{plural(rows.length, "quote")}</span>
        )
      }
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table */}
      <section className="scroll-x" aria-label={`${category} quotes`} tabIndex={0}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Vendor</th>
              <th className="py-2 text-right font-medium">Quote</th>
              <th className="py-2 text-right font-medium">{guests ? `For ${guests}` : "Total"}</th>
              <th className="py-2 pl-4 font-medium">Includes</th>
              <th className="py-2 font-medium">Terms</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, b }) => {
              const firm = b.q.label.includes("·")
                ? (b.q.label.split("·")[0]?.trim() ?? "")
                : v.name || v.category;
              const pkg = b.q.label.includes("·")
                ? b.q.label.split("·").slice(1).join("·").trim()
                : b.q.label;
              const isBooked = v.stage === "booked" && (!v.chosenQuote || v.chosenQuote === b.q.id);
              return (
                <tr key={`${v.id}-${b.q.id}`} className="border-t border-sand-2 align-top">
                  <td className="py-2.5 pr-3">
                    <button type="button" className="link text-left font-medium" onClick={() => onOpen(v.id)}>
                      {firm}
                    </button>
                    {pkg && pkg !== firm && <span className="block text-xs text-muted">{pkg}</span>}
                  </td>
                  <td className="py-2.5 text-right tabular">
                    {inr(b.q.amount)}
                    {b.q.perGuest ? <span className="block text-xs text-muted">a plate</span> : null}
                  </td>
                  <td
                    className={`py-2.5 text-right tabular font-semibold ${b.total === cheapest ? "text-leaf-ink" : ""}`}
                  >
                    {inr(b.total)}
                    {b.total !== cheapest && (
                      <span className="block text-xs font-normal text-muted">+{inr(b.total - cheapest)}</span>
                    )}
                  </td>
                  <td className="max-w-[220px] py-2.5 pl-4 text-xs text-body">{b.q.inclusions ?? "—"}</td>
                  <td className="max-w-[200px] py-2.5 text-xs text-body">{b.q.terms ?? "—"}</td>
                  <td className="py-2.5 pl-2 text-right">
                    {isBooked ? (
                      <Pill tone="ok">booked</Pill>
                    ) : (
                      editable &&
                      !booked && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={`Book ${firm}`}
                          onClick={() => onBook(v, b.q)}
                        >
                          Book…
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </Section>
  );
}

function AddVendor({ ev, onAdd }: { ev: PlannrEvent; onAdd: (v: Vendor) => void }) {
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

function VendorSheet({
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
