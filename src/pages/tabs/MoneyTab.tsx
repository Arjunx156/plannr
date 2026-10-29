import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { RippleDialog } from "../../components/ripple";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill, toneText } from "../../components/ui";
import type { Category, Gift, PayMethod, Payment, PersonalEvent, PlannrEvent } from "../../data/types";
import type { ReadResult } from "../../lib/ai";
import { addDays, longDate, shortDate, TODAY } from "../../lib/dates";
import { inr, inrShort, plural } from "../../lib/format";
import { budgetTotals, whatIf } from "../../lib/metrics";
import { expectedAt, functionCount, giftTotals, settleUp, splitBalances } from "../../shared/derive";
import { functionsOf, list } from "../../shared/records";
import { headcountRipple, type Ripple } from "../../shared/ripple";
import { toast, useStore } from "../../store/store";
import {
  DraftBox,
  newId,
  parseAmount,
  QrCode,
  ReadDocument,
  Section,
  Stat,
  TabPage,
  upiLink,
} from "./common";

const METHOD_LABEL: Record<PayMethod, string> = {
  upi: "UPI",
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  cheque: "Cheque",
};

/** /events/:id/budget — the money: what it costs, what's paid, who owes whom, and gifts in. */
export function MoneyTab({ ev }: { ev: PlannrEvent }) {
  if (ev.layout !== "personal")
    return (
      <TabPage eyebrow={ev.name} title="Budget">
        <p className="m-0 text-body">
          Community events keep their money under{" "}
          <Link to={`/events/${ev.id}/funds`} className="link">
            Funds
          </Link>
          .
        </p>
      </TabPage>
    );
  return <Money ev={ev} />;
}

function Money({ ev }: { ev: PersonalEvent }) {
  const editable = useEditable(ev);
  const t = budgetTotals(ev.budget);
  const payments = list(ev, "payments");
  const due30 = payments.filter((p) => !p.paid && p.date <= addDays(TODAY, 30));
  const late = payments.filter((p) => !p.paid && p.date < TODAY);
  const [read, setRead] = useState<ReadResult | null>(null);
  return (
    <TabPage
      eyebrow={ev.name}
      title="Budget"
      wide
      aside={
        editable && (
          <ReadDocument
            categories={ev.budget.categories.map((c) => c.name)}
            guests={ev.guests}
            onRead={setRead}
          />
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Plan" value={inrShort(t.total)} sub={`${inrShort(t.planned)} given to categories`} />
        <Stat
          label="Spent"
          value={inrShort(t.spent)}
          sub={`${Math.round((t.spent / Math.max(1, t.total)) * 100)}% of the plan`}
        />
        <Stat
          label="Heading for"
          value={inrShort(t.projected)}
          sub={t.over > 0 ? `${inr(t.over)} over plan` : `${inr(-t.over)} headroom`}
          tone={t.over > 0 ? "text-rust-ink" : "text-leaf-ink"}
        />
        <Stat
          label="Due in 30 days"
          value={inrShort(due30.reduce((s, p) => s + p.amount, 0))}
          sub={late.length ? `${plural(late.length, "payment")} overdue` : plural(due30.length, "payment")}
          tone={late.length ? "text-rust-ink" : undefined}
        />
      </div>
      {ev.budget.whatIf && <WhatIf ev={ev} editable={editable} />}
      <Categories ev={ev} editable={editable} />
      <Payments ev={ev} editable={editable} />
      {ev.budget.split && <Split ev={ev} editable={editable} />}
      <Gifts ev={ev} editable={editable} />
      <ReadResultDialog ev={ev} result={read} onClose={() => setRead(null)} />
    </TabPage>
  );
}

// ---------------------------------------------------------------- what-if

function WhatIf({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const range = ev.budget.whatIf;
  const [guests, setGuests] = useState(ev.guests);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  if (!range) return null;
  const result = whatIf(
    { ...ev.budget, whatIf: { ...range, baseGuests: ev.guests } },
    guests,
    ev.budget.total,
  );
  const replies = Math.max(0, ...functionsOf(ev).map((f) => expectedAt(functionCount(ev, f.id))));
  return (
    <Section
      title="What if the guest list changes?"
      aside={<span className="text-sm text-muted">Planned for {ev.guests}</span>}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="whatif-guests" className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Guests</span>
          <span className="font-serif text-[28px] leading-none tabular">{guests}</span>
        </label>
        <input
          id="whatif-guests"
          type="range"
          min={range.min}
          max={range.max}
          step={5}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="w-full accent-[var(--color-peacock)]"
        />
        <span className="flex justify-between text-xs text-muted">
          <span>{range.min}</span>
          {replies > 0 && <span>Replies so far point to about {replies}</span>}
          <span>{range.max}</span>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <ul className="m-0 flex list-none flex-col p-0 text-sm">
          {result.deltas.map((d) => (
            <li
              key={d.category}
              className="flex justify-between gap-3 border-t border-sand-2 py-1.5 first:border-0"
            >
              <span>{d.category}</span>
              <span className="tabular">
                {d.amount ? `${d.amount > 0 ? "+" : "−"}${inr(Math.abs(d.amount))}` : "no change"}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-line py-1.5 font-semibold">
            <span>Heading for</span>
            <span className={`tabular ${result.headroom < 0 ? "text-rust-ink" : "text-leaf-ink"}`}>
              {inr(result.projection)} ·{" "}
              {result.headroom < 0 ? `${inr(-result.headroom)} over` : `${inr(result.headroom)} headroom`}
            </span>
          </li>
        </ul>
        {editable && guests !== ev.guests && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setRipple(headcountRipple(ev, guests))}
          >
            Plan for {guests}…
          </button>
        )}
      </div>
      <RippleDialog ripple={ripple} onClose={() => setRipple(null)} />
    </Section>
  );
}

// ---------------------------------------------------------------- categories

function Categories({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
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

// ---------------------------------------------------------------- payments

function Payments({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [paying, setPaying] = useState<Payment | null>(null);
  const [qr, setQr] = useState<{ link: string; label: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const payments = list(ev, "payments")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const open = payments.filter((p) => !p.paid);
  const paid = payments.filter((p) => p.paid);
  const vendor = (p: Payment) =>
    p.vendorId ? list(ev, "vendors").find((v) => v.id === p.vendorId) : undefined;
  return (
    <Section
      title="Payments"
      aside={
        <span className="flex gap-2">
          {paid.length > 0 && (
            <button type="button" className="link text-xs" onClick={() => setShowPaid((s) => !s)}>
              {showPaid ? "Hide paid" : `Show paid (${paid.length})`}
            </button>
          )}
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
              + Payment
            </button>
          )}
        </span>
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {[...open, ...(showPaid ? paid : [])].map((p) => {
          const v = vendor(p);
          const lateBy = !p.paid && p.date < TODAY;
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span
                className={`w-16 shrink-0 text-xs tabular ${lateBy ? "font-semibold text-rust-ink" : "text-muted"}`}
              >
                {shortDate(p.date)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{p.label}</span>
                <span className="text-xs text-muted">
                  {p.paid
                    ? `Paid${p.paidOn ? ` ${shortDate(p.paidOn)}` : ""}${p.method ? ` · ${METHOD_LABEL[p.method]}` : ""}${p.by ? ` · ${p.by}` : ""}`
                    : lateBy
                      ? "Overdue"
                      : p.estimate
                        ? "Estimate"
                        : (p.by ?? "")}
                </span>
              </span>
              <span className="tabular font-semibold">{inr(p.amount)}</span>
              {p.paid ? (
                editable && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      dispatch({ type: "markPaid", eventId: ev.id, paymentId: p.id, paid: false })
                    }
                  >
                    Not paid
                  </button>
                )
              ) : (
                <span className="flex flex-wrap gap-1.5">
                  {v?.upi && (
                    <>
                      <a
                        href={upiLink(v.upi, v.name || v.category, p.amount, p.label)}
                        className="btn btn-ghost btn-sm md:hidden"
                      >
                        Pay with UPI
                      </a>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm max-md:hidden"
                        onClick={() =>
                          setQr({
                            link: upiLink(v.upi ?? "", v.name || v.category, p.amount, p.label),
                            label: `${p.label} · ${inr(p.amount)} to ${v.name || v.upi}`,
                          })
                        }
                      >
                        UPI QR
                      </button>
                    </>
                  )}
                  {editable && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaying(p)}>
                      Mark paid
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
        {!open.length && !showPaid && (
          <li className="text-sm text-muted">Nothing due. Everything scheduled is paid.</li>
        )}
      </ul>
      <MarkPaid ev={ev} payment={paying} onClose={() => setPaying(null)} />
      <Modal open={!!qr} onClose={() => setQr(null)} title="Scan to pay" width={340}>
        {qr && (
          <div className="flex flex-col items-center gap-3 text-center">
            <QrCode text={qr.link} size={240} label={`UPI payment QR: ${qr.label}`} />
            <span className="text-sm text-body">{qr.label}</span>
            <span className="text-xs text-muted">
              Open any UPI app on your phone and scan. Mark it paid here once it goes through.
            </span>
          </div>
        )}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Schedule a payment">
        <AddPayment ev={ev} onDone={() => setAdding(false)} />
      </Modal>
    </Section>
  );
}

function MarkPaid({
  ev,
  payment,
  onClose,
}: {
  ev: PersonalEvent;
  payment: Payment | null;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const sides = ev.budget.split?.sides ?? [];
  const [on, setOn] = useState(TODAY);
  const [method, setMethod] = useState<PayMethod>("upi");
  const [by, setBy] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    dispatch({
      type: "markPaid",
      eventId: ev.id,
      paymentId: payment.id,
      paid: true,
      on,
      method,
      by: by || payment.by,
    });
    dispatch(toast(`Marked ${inr(payment.amount)} paid. The budget and the family split now include it.`));
    onClose();
  };
  return (
    <Modal open={!!payment} onClose={onClose} title={payment ? `Paid: ${payment.label}` : "Paid"}>
      {payment && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <span className="font-serif text-[28px] leading-none tabular">{inr(payment.amount)}</span>
          <Field label="Paid on" htmlFor="paid-on">
            <input
              id="paid-on"
              type="date"
              className="field"
              value={on}
              max={TODAY}
              onChange={(e) => setOn(e.target.value)}
            />
          </Field>
          <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
            <legend className="label mb-1.5">How</legend>
            {(Object.keys(METHOD_LABEL) as PayMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                className="chip chip-sm"
                onClick={() => setMethod(m)}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </fieldset>
          {sides.length > 0 && (
            <Field label="Paid by" htmlFor="paid-by">
              <select
                id="paid-by"
                className="field"
                value={by || payment.by || ""}
                onChange={(e) => setBy(e.target.value)}
              >
                <option value="">Not counted in the split</option>
                {sides.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <button type="submit" className="btn btn-primary self-start">
            Mark paid
          </button>
        </form>
      )}
    </Modal>
  );
}

function AddPayment({ ev, onDone }: { ev: PersonalEvent; onDone: () => void }) {
  const { dispatch } = useStore();
  const vendors = list(ev, "vendors").filter((v) => v.name);
  const [form, setForm] = useState({
    label: "",
    amount: "",
    date: addDays(TODAY, 14),
    vendorId: "",
    categoryId: "",
  });
  const amount = parseAmount(form.amount);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !amount) return;
    const v = vendors.find((x) => x.id === form.vendorId);
    const record: Payment = {
      id: newId("pay"),
      label: form.label.trim(),
      amount,
      date: form.date,
      paid: false,
      ...(form.vendorId ? { vendorId: form.vendorId } : {}),
      ...(form.categoryId || v?.categoryId ? { categoryId: form.categoryId || v?.categoryId } : {}),
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "payments", record });
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="What for" htmlFor="pay-label">
        <input
          id="pay-label"
          className="field"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Florist advance"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" htmlFor="pay-amount">
          <input
            id="pay-amount"
            className="field"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Due" htmlFor="pay-date">
          <input
            id="pay-date"
            type="date"
            className="field"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Vendor" htmlFor="pay-vendor">
        <select
          id="pay-vendor"
          className="field"
          value={form.vendorId}
          onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
        >
          <option value="">None</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.category})
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Budget category"
        htmlFor="pay-cat"
        hint="Marking it paid adds it to this category's spending."
      >
        <select
          id="pay-cat"
          className="field"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        >
          <option value="">{form.vendorId ? "The vendor's category" : "None"}</option>
          {ev.budget.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="btn btn-primary self-start" disabled={!form.label.trim() || !amount}>
        Schedule {amount ? inr(amount) : ""}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- split

function Split({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const balances = splitBalances(ev);
  const transfers = settleUp(balances);
  const settlements = list(ev, "settlements");
  const total = balances.reduce((s, b) => s + b.paid, 0);
  return (
    <Section
      title="Between the families"
      aside={<span className="text-sm text-muted">{ev.budget.split?.label}</span>}
    >
      <div className="flex h-3 overflow-hidden rounded-full bg-sand-2" aria-hidden="true">
        {balances.map((b) => (
          <span
            key={b.name}
            style={{ width: `${(b.paid / Math.max(1, total)) * 100}%`, background: b.color }}
          />
        ))}
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {balances.map((b) => (
          <li key={b.name} className="flex flex-col gap-1 rounded-xl bg-sand p-3.5 text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden="true" />
              {b.name} · {Math.round(b.share * 100)}%
            </span>
            <span className="tabular">
              Paid {inr(b.paid)} <span className="text-muted">· fair share {inr(b.fair)}</span>
            </span>
            <span
              className={`text-xs ${Math.abs(b.balance) < 1 ? "text-leaf-ink" : b.balance > 0 ? "text-body" : "text-rust-ink"}`}
            >
              {Math.abs(b.balance) < 1
                ? "Even"
                : b.balance > 0
                  ? `Paid ${inr(b.balance)} more than their share`
                  : `${inr(-b.balance)} behind their share`}
            </span>
          </li>
        ))}
      </ul>
      {transfers.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3.5 text-sm">
          <span className="font-semibold">To even it out</span>
          {transfers.map((t) => (
            <span key={`${t.from}-${t.to}`} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t.from} → {t.to}: <strong className="tabular">{inr(t.amount)}</strong>
              </span>
              {editable && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    dispatch({
                      type: "addRecord",
                      eventId: ev.id,
                      coll: "settlements",
                      record: { id: newId("st"), ...t, on: TODAY },
                    });
                    dispatch(toast(`Recorded: ${t.from} paid ${t.to} ${inr(t.amount)}.`));
                  }}
                >
                  Record as settled
                </button>
              )}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-leaf-ink">The families are even at the agreed split.</span>
      )}
      {settlements.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0 text-xs text-muted">
          {settlements.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-1">
              <span>
                {longDate(s.on)}: {s.from} paid {s.to} {inr(s.amount)}
              </span>
              {editable && (
                <button
                  type="button"
                  className="link text-xs"
                  onClick={() =>
                    dispatch({ type: "removeRecord", eventId: ev.id, coll: "settlements", id: s.id })
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- gifts

function thankYou(ev: PersonalEvent, g: Gift): string {
  const what = g.item ? `the lovely ${g.item}` : "your generous blessing";
  return `Dear ${g.from},\nThank you so much for being with us for ${ev.name} and for ${what}. It meant a great deal to the whole family.\nWith love and gratitude`;
}

function Gifts({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const gifts = list(ev, "gifts");
  const households = list(ev, "households");
  const totals = giftTotals(ev);
  const [adding, setAdding] = useState(false);
  const [thanking, setThanking] = useState<Gift | null>(null);
  const [form, setForm] = useState({ from: "", householdId: "", amount: "", item: "" });
  const add = (e: FormEvent) => {
    e.preventDefault();
    const h = households.find((x) => x.id === form.householdId);
    const from = form.from.trim() || h?.name;
    if (!from) return;
    const amount = parseAmount(form.amount);
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "gifts",
      record: {
        id: newId("g"),
        from,
        ...(h ? { householdId: h.id } : {}),
        ...(amount ? { amount } : {}),
        ...(form.item.trim() ? { item: form.item.trim() } : {}),
      },
    });
    setForm({ from: "", householdId: "", amount: "", item: "" });
  };
  const phoneOf = (g: Gift) => households.find((h) => h.id === g.householdId)?.phone;
  return (
    <Section
      title="Gifts and shagun"
      aside={
        <span className="text-sm text-muted">
          {plural(totals.count, "gift")} · {inr(totals.cash)} · {totals.toThank} to thank
        </span>
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {gifts.map((g) => (
          <li
            key={g.id}
            className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
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
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setThanking(g)}>
                    Say thank you
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      dispatch({
                        type: "updateRecord",
                        eventId: ev.id,
                        coll: "gifts",
                        id: g.id,
                        patch: { thanked: true },
                      })
                    }
                  >
                    Thanked
                  </button>
                </span>
              )
            )}
          </li>
        ))}
        {!gifts.length && (
          <li className="text-sm text-muted">
            Gifts and envelopes go here as they come in, so no one is missed in the thank-yous.
          </li>
        )}
      </ul>
      {editable &&
        (adding ? (
          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_1fr_auto] sm:items-end">
            <Field label="From" htmlFor="gift-from">
              <input
                id="gift-from"
                className="field"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                placeholder="Name"
              />
            </Field>
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
            <Field label="Cash (₹)" htmlFor="gift-amount">
              <input
                id="gift-amount"
                className="field"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Gift" htmlFor="gift-item">
              <input
                id="gift-item"
                className="field"
                value={form.item}
                onChange={(e) => setForm({ ...form, item: e.target.value })}
                placeholder="Silver lamp"
              />
            </Field>
            <button
              type="submit"
              className="btn btn-primary btn-sm h-10"
              disabled={!form.from.trim() && !form.householdId}
            >
              Add
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setAdding(true)}>
            + Record a gift
          </button>
        ))}
      <Modal
        open={!!thanking}
        onClose={() => setThanking(null)}
        title={thanking ? `Thank ${thanking.from}` : "Thank you"}
        width={560}
      >
        {thanking && (
          <DraftBox
            task="thanks"
            phone={phoneOf(thanking)}
            context={{
              event: ev.name,
              from: thanking.from,
              gift: thanking.item,
              amount: thanking.amount ? "a cash gift" : undefined,
            }}
            fallback={thankYou(ev, thanking)}
            saveLabel="Mark thanked"
            onSave={(text) => {
              dispatch({
                type: "updateRecord",
                eventId: ev.id,
                coll: "gifts",
                id: thanking.id,
                patch: { thanked: true, thankNote: text },
              });
              setThanking(null);
            }}
          />
        )}
      </Modal>
    </Section>
  );
}

// ---------------------------------------------------------------- reading a bill

function ReadResultDialog({
  ev,
  result,
  onClose,
}: {
  ev: PersonalEvent;
  result: ReadResult | null;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const guess = result?.category
    ? ev.budget.categories.find((c) => c.name.toLowerCase() === result.category?.toLowerCase())?.id
    : undefined;
  const [categoryId, setCategoryId] = useState("");
  const chosen = categoryId || guess || ev.budget.categories[0]?.id || "";
  if (!result) return null;
  const total = result.total ?? result.items.reduce((s, i) => s + i.amount, 0);
  const add = (paid: boolean) => {
    if (!chosen || !total) return;
    dispatch({
      type: "addLineItem",
      eventId: ev.id,
      categoryId: chosen,
      item: {
        id: newId("li"),
        name: result.summary || result.vendor || "From a document",
        vendor: result.vendor ?? "",
        amount: total,
        status: paid ? "paid" : result.kind === "quote" ? "quote" : "unpaid",
        ...(result.kind === "quote" ? { estimate: true } : {}),
      },
      spent: paid ? total : 0,
    });
    for (const p of result.payments)
      if (p.amount > 0)
        dispatch({
          type: "addRecord",
          eventId: ev.id,
          coll: "payments",
          record: {
            id: newId("pay"),
            label: p.label,
            amount: p.amount,
            date: p.date ?? addDays(TODAY, 14),
            paid: false,
            categoryId: chosen,
          },
        });
    dispatch(
      toast(
        result.payments.length
          ? `Added, with ${plural(result.payments.length, "payment")} on the schedule.`
          : "Added to the budget.",
      ),
    );
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="What Plannr read" width={560}>
      <div className="flex flex-col gap-3 text-sm">
        <span>
          A {result.kind === "other" ? "document" : result.kind}
          {result.vendor ? ` from ${result.vendor}` : ""}
          {result.date ? `, dated ${longDate(result.date)}` : ""}.
        </span>
        {result.items.length > 0 && (
          <ul className="m-0 flex list-none flex-col p-0">
            {result.items.map((i) => (
              <li
                key={`${i.label}-${i.amount}`}
                className="flex justify-between gap-3 border-t border-sand-2 py-1.5 first:border-0"
              >
                <span>{i.label}</span>
                <span className="tabular">{inr(i.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <span className="font-semibold tabular">
          Total {inr(total)}
          {result.perGuest ? " per guest" : ""}
        </span>
        {result.payments.length > 0 && (
          <span className="text-body">
            Payments:{" "}
            {result.payments
              .map((p) => `${p.label} ${inr(p.amount)}${p.date ? ` by ${shortDate(p.date)}` : ""}`)
              .join(" · ")}
          </span>
        )}
        {result.inclusions && <span className="text-body">Includes: {result.inclusions}</span>}
        {result.terms && <span className="text-body">Terms: {result.terms}</span>}
        <Field label="Budget category" htmlFor="read-cat">
          <select
            id="read-cat"
            className="field"
            value={chosen}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {ev.budget.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <span className="text-xs text-muted">
          Check the numbers against the paper before adding. Nothing is added until you choose.
        </span>
        <span className="flex flex-wrap gap-2">
          {result.kind === "bill" && (
            <button type="button" className="btn btn-primary" disabled={!total} onClick={() => add(true)}>
              Add as paid
            </button>
          )}
          <button
            type="button"
            className={`btn ${result.kind === "bill" ? "btn-secondary" : "btn-primary"}`}
            disabled={!total}
            onClick={() => add(false)}
          >
            {result.kind === "quote" ? "Add as an estimate" : "Add as to pay"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </span>
      </div>
    </Modal>
  );
}
