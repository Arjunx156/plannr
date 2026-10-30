import { useState } from "react";
import { Link } from "react-router";
import { RippleDialog } from "../../components/ripple";
import { useEditable } from "../../components/tasks";
import { Field, Modal } from "../../components/ui";
import type { LineItem, Payment, PayStatus, PersonalEvent, PlannrEvent } from "../../data/types";
import type { ReadResult } from "../../lib/ai";
import { addDays, longDate, shortDate, TODAY } from "../../lib/dates";
import { inr, inrShort, plural } from "../../lib/format";
import { budgetTotals, whatIf } from "../../lib/metrics";
import { expectedAt, functionCount } from "../../shared/derive";
import { functionsOf, list } from "../../shared/records";
import { headcountRipple, type Ripple } from "../../shared/ripple";
import { toast, useStore } from "../../store/store";
import { newId, ReadDocument, Section, Stat, TabPage } from "./common";
import { Categories } from "./money/Categories";
import { Gifts } from "./money/Gifts";
import { Payments } from "./money/Payments";
import { Split } from "./money/Split";

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

// ---------------------------------------------------------------- reading a bill

/** Days until a payment read from a document falls due when the document doesn't say. */
const DEFAULT_DUE_DAYS = 14;

/** A paid bill, an unpaid one, or a quote (kept as an estimate until it's booked). */
function itemStatus(paid: boolean, kind: ReadResult["kind"]): PayStatus {
  if (paid) return "paid";
  return kind === "quote" ? "quote" : "unpaid";
}

/** The budget line a read document becomes. */
function lineItemFrom(result: ReadResult, total: number, paid: boolean): LineItem {
  return {
    id: newId("li"),
    name: result.summary || result.vendor || "From a document",
    vendor: result.vendor ?? "",
    amount: total,
    status: itemStatus(paid, result.kind),
    ...(result.kind === "quote" ? { estimate: true } : {}),
  };
}

/** The instalments a document lists, as payments on the schedule under one category. */
function paymentsFrom(result: ReadResult, categoryId: string): Payment[] {
  return result.payments
    .filter((p) => p.amount > 0)
    .map((p) => ({
      id: newId("pay"),
      label: p.label,
      amount: p.amount,
      date: p.date ?? addDays(TODAY, DEFAULT_DUE_DAYS),
      paid: false,
      categoryId,
    }));
}

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
      item: lineItemFrom(result, total, paid),
      spent: paid ? total : 0,
    });
    for (const record of paymentsFrom(result, chosen))
      dispatch({ type: "addRecord", eventId: ev.id, coll: "payments", record });
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
