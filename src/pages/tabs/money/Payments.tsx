import { type FormEvent, useState } from "react";
import { Field, Modal, TextField } from "../../../components/ui";
import type { PayMethod, Payment, PersonalEvent, Vendor } from "../../../data/types";
import { addDays, shortDate, TODAY } from "../../../lib/dates";
import { inr } from "../../../lib/format";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { CategorySelect, newId, parseAmount, QrCode, Section, upiLink, WhatForAmount } from "../common";
import { METHOD_LABEL } from "./shared";

/** The payment schedule: what is due when, with UPI links and marking as paid. */
export function Payments({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [paying, setPaying] = useState<Payment | null>(null);
  const [qr, setQr] = useState<UpiQr | null>(null);
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
        {[...open, ...(showPaid ? paid : [])].map((p) => (
          <PaymentRow
            key={p.id}
            payment={p}
            vendor={vendor(p)}
            editable={editable}
            onPay={() => setPaying(p)}
            onUnpay={() => dispatch({ type: "markPaid", eventId: ev.id, paymentId: p.id, paid: false })}
            onQr={setQr}
          />
        ))}
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

/** The line under a payment's name: when and how it was paid, or that it's overdue or an estimate. */
function paymentNote(p: Payment, late: boolean): string {
  if (p.paid) {
    const on = p.paidOn ? ` ${shortDate(p.paidOn)}` : "";
    const how = p.method ? ` · ${METHOD_LABEL[p.method]}` : "";
    return `Paid${on}${how}${p.by ? ` · ${p.by}` : ""}`;
  }
  if (late) return "Overdue";
  return p.estimate ? "Estimate" : (p.by ?? "");
}

type UpiQr = { link: string; label: string };

/** One scheduled payment: its date, what it's for, and paying it by UPI or marking it paid. */
function PaymentRow({
  payment: p,
  vendor: v,
  editable,
  onPay,
  onUnpay,
  onQr,
}: {
  payment: Payment;
  vendor: Vendor | undefined;
  editable: boolean;
  onPay: () => void;
  onUnpay: () => void;
  onQr: (qr: UpiQr) => void;
}) {
  const late = !p.paid && p.date < TODAY;
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0">
      <span
        className={`w-16 shrink-0 text-xs tabular ${late ? "font-semibold text-rust-ink" : "text-muted"}`}
      >
        {shortDate(p.date)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{p.label}</span>
        <span className="text-xs text-muted">{paymentNote(p, late)}</span>
      </span>
      <span className="tabular font-semibold">{inr(p.amount)}</span>
      {p.paid && editable && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onUnpay}>
          Not paid
        </button>
      )}
      {!p.paid && (
        <span className="flex flex-wrap gap-1.5">
          {v?.upi && <UpiButtons upi={v.upi} vendor={v} payment={p} onQr={onQr} />}
          {editable && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onPay}>
              Mark paid
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/** A UPI deep link on phones; a QR to scan with a phone on larger screens. */
function UpiButtons({
  upi,
  vendor: v,
  payment: p,
  onQr,
}: {
  upi: string;
  vendor: Vendor;
  payment: Payment;
  onQr: (qr: UpiQr) => void;
}) {
  const link = upiLink(upi, v.name || v.category, p.amount, p.label);
  return (
    <>
      <a href={link} className="btn btn-ghost btn-sm md:hidden">
        Pay with UPI
      </a>
      <button
        type="button"
        className="btn btn-ghost btn-sm max-md:hidden"
        onClick={() => onQr({ link, label: `${p.label} · ${inr(p.amount)} to ${v.name || upi}` })}
      >
        UPI QR
      </button>
    </>
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
      <WhatForAmount
        id="pay"
        label={form.label}
        amount={form.amount}
        placeholder="Florist advance"
        onChange={(patch) => setForm({ ...form, ...patch })}
        beside={
          <TextField
            id="pay-date"
            label="Due"
            value={form.date}
            onChange={(date) => setForm({ ...form, date })}
            type="date"
          />
        }
      />
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
      <CategorySelect
        id="pay-cat"
        categories={ev.budget.categories}
        value={form.categoryId}
        onChange={(categoryId) => setForm({ ...form, categoryId })}
        none={form.vendorId ? "The vendor's category" : "None"}
        hint="Marking it paid adds it to this category's spending."
      />
      <button type="submit" className="btn btn-primary self-start" disabled={!form.label.trim() || !amount}>
        Schedule {amount ? inr(amount) : ""}
      </button>
    </form>
  );
}
