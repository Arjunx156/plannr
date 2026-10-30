import type { PlannrEvent } from "../data/types";
import { addDays, daysBetween, longDate, TODAY } from "../lib/dates";
import { inr, inrSigned } from "../lib/format";
import { budgetTotals } from "../lib/metrics";
import type { EventAction } from "./engine";
import { replay } from "./engine";
import { bookingSchedule } from "./planActions";
import { findRecord, functionsOf, list } from "./records";

/**
 * The ripple: before a change is applied, follow it through the plan and show everything
 * it moves. A headcount change reaches catering, invitations and favours; booking a vendor
 * sets its budget line and payment schedule; moving a function moves its tasks. The
 * planner sees each consequence as a line they can untick, and nothing applies until yes.
 */

export interface RippleLine {
  id: string;
  title: string;
  detail: string;
  /** Actions this line adds; empty for a heads-up that changes nothing. */
  actions: EventAction[];
  /** Unticking it leaves the consequence out. The change itself can't be unticked. */
  optional: boolean;
  warn?: boolean;
}

export interface Ripple {
  title: string;
  lines: RippleLine[];
}

/** Guests seated at one table. */
const TABLE_SIZE = 10;
/** Share of a booking paid as the advance. */
const ADVANCE_SHARE = 0.3;
/** Scheduled payments within this many rupees of the new total count as matching it. */
const ROUNDING_SLACK = 1;

type Personal = Extract<PlannrEvent, { layout: "personal" }>;
type Vendor = ReturnType<typeof list<"vendors">>[number];
type Quote = Vendor["quotes"][number];
type Category = ReturnType<typeof list<"categories">>[number];

/** Categories priced per guest, from the plan's what-if rates. */
function perGuestRates(ev: PlannrEvent): { id: string; name: string; rate: number }[] {
  if (ev.layout !== "personal" || !ev.budget.whatIf) return [];
  return ev.budget.whatIf.rates.flatMap((r) => {
    const c = ev.budget.categories.find((x) => x.name.toLowerCase() === r.category.toLowerCase());
    return c ? [{ id: c.id, name: c.name, rate: r.perGuest }] : [];
  });
}

/** Each per-guest budget line moves by the change in guests times its rate. */
function perGuestLines(ev: Personal, diff: number): RippleLine[] {
  if (!diff) return [];
  return perGuestRates(ev).flatMap((r) => {
    const c = findRecord(ev, "categories", r.id);
    if (!c) return [];
    const amount = diff * r.rate;
    const projected = Math.max(0, (c.projected ?? c.planned) + amount);
    return [
      {
        id: `cat-${r.id}`,
        title: r.name,
        detail: `${inrSigned(amount)} · ${Math.abs(diff)} × ${inr(r.rate)}`,
        actions: [
          { type: "updateRecord", eventId: ev.id, coll: "categories", id: c.id, patch: { projected } },
        ],
        optional: true,
      },
    ];
  });
}

/** How many tables of ten the new headcount adds or frees. */
function seatingLines(from: number, to: number): RippleLine[] {
  const tables = Math.ceil(to / TABLE_SIZE) - Math.ceil(from / TABLE_SIZE);
  if (!tables) return [];
  const sign = tables > 0 ? "+" : "";
  const noun = Math.abs(tables) === 1 ? "table" : "tables";
  return [
    {
      id: "seating",
      title: "Seating",
      detail: `${sign}${tables} ${noun} of ${TABLE_SIZE}`,
      actions: [],
      optional: true,
    },
  ];
}

/** A heads-up for each venue the new headcount no longer fits. */
function capacityLines(ev: PlannrEvent, guests: number): RippleLine[] {
  return functionsOf(ev).flatMap((f) =>
    f.capacity && guests > f.capacity
      ? [
          {
            id: `cap-${f.id}`,
            title: "Heads-up",
            detail: `${f.place ?? f.label} seats ${f.capacity}; ${guests - f.capacity} more than fit.`,
            actions: [],
            optional: true,
            warn: true,
          },
        ]
      : [],
  );
}

/** What changing the planned headcount moves. */
export function headcountRipple(ev: PlannrEvent, guests: number): Ripple {
  if (ev.layout !== "personal") return { title: `Plan for ${guests}`, lines: [] };
  const headcount: RippleLine = {
    id: "headcount",
    title: "Headcount",
    detail: `${ev.guests} → ${guests}`,
    actions: [{ type: "setHeadcount", eventId: ev.id, guests }],
    optional: false,
  };
  const lines = [
    headcount,
    ...perGuestLines(ev, guests - ev.guests),
    ...seatingLines(ev.guests, guests),
    ...capacityLines(ev, guests),
  ];
  return withBudget(ev, { title: `Plan for ${guests} guests`, lines });
}

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
  if (scheduled.length) {
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

/** What moving a function moves: its open tasks come with it. */
export function moveFunctionRipple(ev: PlannrEvent, fnId: string, date: string): Ripple {
  const f = functionsOf(ev).find((x) => x.id === fnId);
  if (!f || ev.layout === "empty") return { title: "Move", lines: [] };
  const shift = daysBetween(f.date, date);
  const tasks = ev.tasks.list.filter((t) => t.fn === fnId && !t.done);
  const lines: RippleLine[] = [
    {
      id: "date",
      title: `${f.label} date`,
      detail: `${longDate(f.date)} → ${longDate(date)}`,
      actions: [{ type: "updateRecord", eventId: ev.id, coll: "functions", id: f.id, patch: { date } }],
      optional: false,
    },
  ];
  if (shift && tasks.length)
    lines.push({
      id: "tasks",
      title: `${tasks.length} ${tasks.length === 1 ? "task moves" : "tasks move"} with it`,
      detail: tasks
        .map((t) => t.title)
        .slice(0, 3)
        .join(" · "),
      actions: tasks.map((t) => ({
        type: "updateTask",
        eventId: ev.id,
        taskId: t.id,
        patch: { due: addDays(t.due, shift) },
      })),
      optional: true,
    });
  const vendors = list(ev, "vendors").filter((v) => v.arrivals?.some((a) => a.fnId === fnId));
  if (vendors.length && shift)
    lines.push({
      id: "vendors",
      title: "Tell your vendors",
      detail: `${vendors.map((v) => v.name || v.category).join(", ")} ${vendors.length === 1 ? "has" : "have"} a call sheet for this function. Their sheet updates; let them know too.`,
      actions: [],
      optional: true,
      warn: true,
    });
  return { title: `Move ${f.label}`, lines };
}

/** Any proposed changes, with the budget and family-split lines worked out from them. */
export function genericRipple(
  ev: PlannrEvent,
  title: string,
  actions: EventAction[],
  describe: (a: EventAction) => string,
): Ripple {
  return withBudget(ev, {
    title,
    lines: actions.map((a, i) => ({
      id: `a${i}`,
      title: describe(a),
      detail: "",
      actions: [a],
      optional: actions.length > 1,
    })),
  });
}

/** Adds the effect on the total and on each family's share, from applying every line. */
function withBudget(ev: PlannrEvent, r: Ripple): Ripple {
  if (ev.layout !== "personal") return r;
  const after = replay(
    ev,
    r.lines.flatMap((l) => l.actions),
  );
  if (after.layout !== "personal") return r;
  const before = budgetTotals(ev.budget).projected;
  const next = budgetTotals(after.budget).projected;
  const delta = next - before;
  if (!delta) return r;
  const over = next - ev.budget.total;
  const lines = [...r.lines];
  lines.push({
    id: "budget",
    title: "Budget",
    detail: `Projected ${inr(before)} → ${inr(next)}${over > 0 ? ` · ${inr(over)} over plan` : ` · ${inr(-over)} headroom`}`,
    actions: [],
    optional: true,
    warn: over > 0,
  });
  for (const side of ev.budget.split?.sides ?? [])
    lines.push({
      id: `split-${side.name}`,
      title: side.name,
      detail: `${inrSigned(Math.round(delta * side.share))} at the agreed ${Math.round(side.share * 100)}%`,
      actions: [],
      optional: true,
    });
  return { ...r, lines };
}

/** The actions for the lines the planner kept. */
export function chosenActions(r: Ripple, kept: Set<string>): EventAction[] {
  return r.lines.filter((l) => !l.optional || kept.has(l.id)).flatMap((l) => l.actions);
}
