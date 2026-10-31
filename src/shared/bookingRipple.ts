import type { PlannrEvent } from "../data/types";
import { longDate, TODAY } from "../lib/dates";
import { inr } from "../lib/format";
import type { EventAction } from "./engine";
import { bookingSchedule } from "./planActions";
import { findRecord, list } from "./records";
import {
  ADVANCE_SHARE,
  type Category,
  type Quote,
  type Ripple,
  type RippleLine,
  ROUNDING_SLACK,
  type Vendor,
  withBudget,
} from "./ripple";

/** The booking itself; a shortlisted quote from another firm ("Firm · package") also names the firm. */
function bookLine(ev: PlannrEvent, v: Vendor, quote: Quote | undefined, label: string): RippleLine {
  const namesFirm = label && label !== v.name && (!v.name || quote?.label.includes("·"));
  const rename: EventAction[] = namesFirm
    ? [{ type: "updateRecord", eventId: ev.id, coll: "vendors", id: v.id, patch: { name: label } }]
    : [];
  return {
    id: "book",
    title: v.category,
    detail: `Booked: ${label}`,
    actions: [...rename, { type: "bookVendor", eventId: ev.id, vendorId: v.id, quoteId: quote?.id }],
    optional: false,
  };
}
/** What a quote comes to: per-guest quotes times the planned headcount. */
function quoteTotal(quote: Quote | undefined, guests: number): number {
  if (!quote) return 0;
  return quote.perGuest ? quote.amount * guests : quote.amount;
}
/** The vendor's budget line moving to the booked total. */
function budgetLine(
  ev: PlannrEvent,
  c: Category,
  total: number,
  quote: Quote | undefined,
  guests: number,
): RippleLine {
  const perGuest = quote?.perGuest ? ` · ${guests} × ${inr(quote.amount)}` : "";
  return {
    id: "budget-line",
    title: c.name,
    detail: `${inr(c.projected ?? c.planned)} → ${inr(total)}${perGuest}`,
    actions: [
      { type: "updateRecord", eventId: ev.id, coll: "categories", id: c.id, patch: { projected: total } },
    ],
    optional: true,
    warn: total > c.planned,
  };
}
/** The advance, rounded to the nearest thousand when the total allows. */
function advanceFor(total: number): number {
  return Math.round((total * ADVANCE_SHARE) / 1000) * 1000 || Math.round(total * ADVANCE_SHARE);
}
/** One payment for the new schedule. */
function paymentAction(
  ev: PlannrEvent,
  v: Vendor,
  c: Category | undefined,
  part: { key: "adv" | "bal"; date: string; label: string; amount: number },
): EventAction {
  const record = {
    id: `pay-${v.id}-${part.key}`,
    date: part.date,
    label: part.label,
    amount: part.amount,
    paid: false,
    vendorId: v.id,
    ...(c ? { categoryId: c.id } : {}),
  };
  return { type: "addRecord", eventId: ev.id, coll: "payments", record };
}
/** A heads-up when payments already scheduled don't add up to the new total; else a fresh schedule. */
function paymentLines(
  ev: PlannrEvent,
  v: Vendor,
  c: Category | undefined,
  label: string,
  total: number,
): RippleLine[] {
  if (!total) return [];
  const scheduled = list(ev, "payments").filter((p) => p.vendorId === v.id);
  if (scheduled.length > 0) {
    const sum = scheduled.reduce((acc, p) => acc + p.amount, 0);
    if (Math.abs(sum - total) <= ROUNDING_SLACK) return [];
    const detail = `${scheduled.length} already scheduled for ${inr(sum)}, against ${inr(total)} now. Check them on the Budget page.`;
    return [{ id: "payments", title: "Payments", detail, actions: [], optional: true, warn: true }];
  }
  const { advance, balance } = bookingSchedule(ev.date, TODAY);
  const adv = advanceFor(total);
  return [
    {
      id: "payments",
      title: "Payments",
      detail: `${inr(adv)} advance by ${longDate(advance)}, ${inr(total - adv)} balance by ${longDate(balance)}`,
      actions: [
        paymentAction(ev, v, c, { key: "adv", date: advance, label: `${label} advance`, amount: adv }),
        paymentAction(ev, v, c, {
          key: "bal",
          date: balance,
          label: `${label} balance`,
          amount: total - adv,
        }),
      ],
      optional: true,
    },
  ];
}

/** What booking a vendor moves: its budget line and its payment schedule. */
export function bookingRipple(ev: PlannrEvent, vendorId: string, quoteId?: string): Ripple {
  const v = findRecord(ev, "vendors", vendorId);
  if (!v) return { title: "Book", lines: [] };
  const quote = v.quotes.find((q) => q.id === (quoteId ?? v.chosenQuote)) ?? v.quotes[0];
  const label = quote?.label.split("·")[0]?.trim() || v.name || v.category;
  const guests = ev.layout === "personal" ? ev.guests : 0;
  const total = quoteTotal(quote, guests);
  const c = v.categoryId ? findRecord(ev, "categories", v.categoryId) : undefined;
  const lines = [
    bookLine(ev, v, quote, label),
    ...(c && total ? [budgetLine(ev, c, total, quote, guests)] : []),
    ...paymentLines(ev, v, c, label, total),
  ];
  return withBudget(ev, { title: `Book ${label}`, lines });
}
