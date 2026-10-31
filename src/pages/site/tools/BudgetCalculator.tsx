import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import type { Kind } from "../../../data/baseTypes";
import { inr, parseAmount } from "../../../lib/format";
import { splitBudget } from "../../../lib/plan";
import { CallToAction, SitePage } from "../siteLayout";

const KINDS: { id: Kind; label: string }[] = [
  { id: "wedding", label: "Wedding" },
  { id: "birthday", label: "Birthday" },
  { id: "community", label: "Community event" },
  { id: "other", label: "Something else" },
];

/** /tools/budget-calculator — splits a total across categories for the kind of event and its guest count. */
export function BudgetCalculator() {
  const [kind, setKind] = useState<Kind>("wedding");
  const [total, setTotal] = useState("18L");
  const [guests, setGuests] = useState("250");
  const amount = parseAmount(total);
  const people = Math.max(0, Math.round(Number(guests) || 0));
  const lines = amount ? splitBudget(kind, amount) : [];
  const catering = lines.find((l) => /catering|food/i.test(l.name));
  return (
    <SitePage
      title="Event budget splitter"
      description="Split a wedding, birthday or festival budget across categories, and see what it means per guest and per plate. Free, no sign-up."
      eyebrow="Free tool"
      heading="Budget splitter"
      lead="Enter a total and a headcount. The split is a sensible starting point for your kind of event; move it to fit your priorities."
    >
      <form
        onSubmit={(e: FormEvent) => e.preventDefault()}
        className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-3"
      >
        <Field label="Event" htmlFor="bc-kind">
          <select
            id="bc-kind"
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Total budget" htmlFor="bc-total" hint="18L, 18 lakh or 18,00,000">
          <input
            id="bc-total"
            className="field"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </Field>
        <Field label="Guests" htmlFor="bc-guests">
          <input
            id="bc-guests"
            className="field"
            inputMode="numeric"
            value={guests}
            onChange={(e) => setGuests(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </form>
      {amount > 0 ? (
        <section
          aria-label="The split"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="font-serif text-[26px] leading-tight">
            {inr(amount)}
            {people ? ` for ${people} guests: ${inr(amount / people)} a guest` : ""}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {lines.map((l) => (
              <li
                key={l.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-sand-2 py-2.5 first:border-0"
              >
                <span className="font-medium">{l.name}</span>
                <span className="tabular">{inr(l.amount)}</span>
                <span className="col-span-2 block h-2 rounded-[2px] bg-sand-2">
                  <span
                    className="block h-2 rounded-[2px]"
                    style={{ width: `${(l.amount / amount) * 100}%`, background: l.color }}
                  />
                </span>
              </li>
            ))}
          </ul>
          {catering && people > 0 && (
            <p className="m-0 text-sm text-body">
              The catering line allows about <strong>{inr(catering.amount / people)} a plate</strong>. Compare
              that with the per-plate quotes you get, multiplied by the guests you expect at each meal.
            </p>
          )}
        </section>
      ) : (
        <p className="m-0 text-body">Enter a total, like 18L or 2,50,000.</p>
      )}
      <CallToAction
        prompt={`${KINDS.find((k) => k.id === kind)?.label ?? "Event"} for ${people || 100} guests, budget ${total}`}
      />
    </SitePage>
  );
}
