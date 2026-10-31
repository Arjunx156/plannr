import { useState } from "react";
import { Link } from "react-router";
import { RippleDialog } from "../../components/ripple";
import { useEditable } from "../../components/taskHooks";
import type { PersonalEvent, PlannrEvent } from "../../data/types";
import type { ReadResult } from "../../lib/ai";
import { addDays, TODAY } from "../../lib/dates";
import { inr, inrShort, plural } from "../../lib/format";
import { budgetTotals, whatIf } from "../../lib/metrics";
import { expectedAt, functionCount } from "../../shared/derive";
import { functionsOf } from "../../shared/eventLists";
import { list } from "../../shared/records";
import { headcountRipple, type Ripple } from "../../shared/ripple";
import { Section, Stat, TabPage } from "./layout";
import { Categories } from "./money/Categories";
import { Gifts } from "./money/Gifts";
import { Payments } from "./money/Payments";
import { ReadResultDialog } from "./money/ReadResultDialog";
import { Split } from "./money/Split";
import { ReadDocument } from "./ReadDocument";

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
          sub={
            late.length > 0 ? `${plural(late.length, "payment")} overdue` : plural(due30.length, "payment")
          }
          tone={late.length > 0 ? "text-rust-ink" : undefined}
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
