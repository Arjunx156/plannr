import type { PlannrEvent } from "../data/types";
import { addDays, daysBetween, longDate } from "../lib/dates";
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

const today = () => new Date().toISOString().slice(0, 10);

/** Categories priced per guest, from the plan's what-if rates. */
function perGuestRates(ev: PlannrEvent): { id: string; name: string; rate: number }[] {
  if (ev.layout !== "personal" || !ev.budget.whatIf) return [];
  return ev.budget.whatIf.rates.flatMap((r) => {
    const c = ev.budget.categories.find((x) => x.name.toLowerCase() === r.category.toLowerCase());
    return c ? [{ id: c.id, name: c.name, rate: r.perGuest }] : [];
  });
}

/** What changing the planned headcount moves. */
export function headcountRipple(ev: PlannrEvent, guests: number): Ripple {
  if (ev.layout !== "personal") return { title: `Plan for ${guests}`, lines: [] };
  const diff = guests - ev.guests;
  const lines: RippleLine[] = [
    {
      id: "headcount",
      title: "Headcount",
      detail: `${ev.guests} → ${guests}`,
      actions: [{ type: "setHeadcount", eventId: ev.id, guests }],
      optional: false,
    },
  ];
  for (const r of perGuestRates(ev)) {
    const c = findRecord(ev, "categories", r.id);
    if (!c || !diff) continue;
    const amount = diff * r.rate;
    lines.push({
      id: `cat-${r.id}`,
      title: r.name,
      detail: `${inrSigned(amount)} · ${Math.abs(diff)} × ${inr(r.rate)}`,
      actions: [
        {
          type: "updateRecord",
          eventId: ev.id,
          coll: "categories",
          id: c.id,
          patch: { projected: Math.max(0, (c.projected ?? c.planned) + amount) },
        },
      ],
      optional: true,
    });
  }
  const tables = Math.ceil(guests / 10) - Math.ceil(ev.guests / 10);
  if (tables)
    lines.push({
      id: "seating",
      title: "Seating",
      detail: `${tables > 0 ? "+" : ""}${tables} ${Math.abs(tables) === 1 ? "table" : "tables"} of 10`,
      actions: [],
      optional: true,
    });
  for (const f of functionsOf(ev))
    if (f.capacity && guests > f.capacity)
      lines.push({
        id: `cap-${f.id}`,
        title: "Heads-up",
        detail: `${f.place ?? f.label} seats ${f.capacity}; ${guests - f.capacity} more than fit.`,
        actions: [],
        optional: true,
        warn: true,
      });
  return withBudget(ev, { title: `Plan for ${guests} guests`, lines });
}

/** What booking a vendor moves: its budget line and its payment schedule. */
export function bookingRipple(ev: PlannrEvent, vendorId: string, quoteId?: string): Ripple {
  const v = findRecord(ev, "vendors", vendorId);
  if (!v) return { title: "Book", lines: [] };
  const quote = v.quotes.find((q) => q.id === (quoteId ?? v.chosenQuote)) ?? v.quotes[0];
  const label = quote?.label.split("·")[0]?.trim() || v.name || v.category;
  const lines: RippleLine[] = [
    {
      id: "book",
      title: v.category,
      detail: `Booked: ${label}`,
      actions: [
        // Shortlisted quotes from other firms read "Firm · package": booking one names the firm.
        ...(label && label !== v.name && (!v.name || quote?.label.includes("·"))
          ? [
              {
                type: "updateRecord",
                eventId: ev.id,
                coll: "vendors",
                id: v.id,
                patch: { name: label },
              } as EventAction,
            ]
          : []),
        { type: "bookVendor", eventId: ev.id, vendorId: v.id, quoteId: quote?.id },
      ],
      optional: false,
    },
  ];
  const guests = ev.layout === "personal" ? ev.guests : 0;
  const total = quote ? (quote.perGuest ? quote.amount * guests : quote.amount) : 0;
  const c = v.categoryId ? findRecord(ev, "categories", v.categoryId) : undefined;
  if (c && total) {
    const before = c.projected ?? c.planned;
    lines.push({
      id: "budget-line",
      title: c.name,
      detail: `${inr(before)} → ${inr(total)}${quote?.perGuest ? ` · ${guests} × ${inr(quote.amount)}` : ""}`,
      actions: [
        { type: "updateRecord", eventId: ev.id, coll: "categories", id: c.id, patch: { projected: total } },
      ],
      optional: true,
      warn: total > c.planned,
    });
  }
  const scheduled = list(ev, "payments").filter((p) => p.vendorId === v.id);
  const scheduledSum = scheduled.reduce((sum, p) => sum + p.amount, 0);
  if (total && scheduled.length && Math.abs(scheduledSum - total) > 1)
    lines.push({
      id: "payments",
      title: "Payments",
      detail: `${scheduled.length} already scheduled for ${inr(scheduledSum)}, against ${inr(total)} now. Check them on the Budget page.`,
      actions: [],
      optional: true,
      warn: true,
    });
  if (total && !scheduled.length) {
    const { advance, balance } = bookingSchedule(ev.date, today());
    const adv = Math.round((total * 0.3) / 1000) * 1000 || Math.round(total * 0.3);
    lines.push({
      id: "payments",
      title: "Payments",
      detail: `${inr(adv)} advance by ${longDate(advance)}, ${inr(total - adv)} balance by ${longDate(balance)}`,
      actions: [
        {
          type: "addRecord",
          eventId: ev.id,
          coll: "payments",
          record: {
            id: `pay-${v.id}-adv`,
            date: advance,
            label: `${label} advance`,
            amount: adv,
            paid: false,
            vendorId: v.id,
            ...(c ? { categoryId: c.id } : {}),
          },
        },
        {
          type: "addRecord",
          eventId: ev.id,
          coll: "payments",
          record: {
            id: `pay-${v.id}-bal`,
            date: balance,
            label: `${label} balance`,
            amount: total - adv,
            paid: false,
            vendorId: v.id,
            ...(c ? { categoryId: c.id } : {}),
          },
        },
      ],
      optional: true,
    });
  }
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
