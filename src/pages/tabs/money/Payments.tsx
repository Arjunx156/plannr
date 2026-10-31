import { useState } from "react";
import { Modal } from "../../../components/overlays";
import { QrCode } from "../../../components/qr";
import type { Payment } from "../../../data/budgetTypes";
import type { PersonalEvent } from "../../../data/types";
import type { Vendor } from "../../../data/vendorTypes";
import { shortDate, TODAY } from "../../../lib/dates";
import { inr } from "../../../lib/format";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { Section } from "../layout";
import { upiLink } from "../links";
import { AddPayment } from "./AddPayment";
import { MarkPaid } from "./MarkPaid";
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
        {open.length === 0 && !showPaid && (
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
