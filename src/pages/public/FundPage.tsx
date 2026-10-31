import { type ReactNode, useMemo } from "react";
import { FundProgress } from "../../components/ui";
import { inr } from "../../lib/format";
import { fill } from "../../lib/guestText";
import type { FundView } from "../../shared/public";
import { Card, PublicShell, useLinkLang } from "./shell";

/** The public fund report: what came in, what was spent and who sponsored it. */
export function FundPage({ view, preview }: { view: FundView; preview?: ReactNode }) {
  const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;
  const tiers = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const s of view.sponsors) out.set(s.tier, [...(out.get(s.tier) ?? []), s.name]);
    return [...out.entries()];
  }, [view.sponsors]);
  const { t, shell } = useLinkLang(view.event);
  return (
    <PublicShell event={view.event} eyebrow={t.fundReport} preview={preview} {...shell}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [
            t.collected,
            inr(view.received),
            fill(t.collectedOf, { pct: pct(view.received, view.expected), expected: inr(view.expected) }),
          ],
          [t.spent, inr(view.spent), fill(t.ofBudget, { budget: inr(view.budget) })],
          [
            t.awaiting,
            inr(view.pending.amount),
            view.pending.count === 1 ? t.expenseOne : fill(t.expenseMany, { n: view.pending.count }),
          ],
        ].map(([label, value, sub]) => (
          <div key={label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <span className="eyebrow text-muted">{label}</span>
            <span className="font-serif text-[26px] leading-none tabular">{value}</span>
            <span className="text-xs text-body">{sub}</span>
          </div>
        ))}
      </div>
      <Card label={t.moneyFrom}>
        <h2 className="font-serif text-[22px]">{t.moneyFrom}</h2>
        <ul className="m-0 flex list-none flex-col p-0">
          {view.sources.map((s) => (
            <li
              key={s.label}
              className="flex justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="font-medium">{s.label}</span>
              <FundProgress received={s.received} expected={s.expected} />
            </li>
          ))}
        </ul>
      </Card>
      <Card label={t.approvedSpending}>
        <h2 className="font-serif text-[22px]">{t.approvedSpending}</h2>
        {view.expenses.length > 0 ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {view.expenses.map((e) => (
              <li
                key={e.label}
                className="flex justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
              >
                <span>{e.label}</span>
                <span className="tabular">{inr(e.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">{t.noExpenses}</p>
        )}
      </Card>
      {tiers.length > 0 && (
        <Card label={t.thanksSponsors}>
          <h2 className="font-serif text-[22px]">{t.thanksSponsors}</h2>
          {tiers.map(([tier, names]) => (
            <p key={tier} className="m-0 text-sm">
              <span className="eyebrow mr-2 text-muted">{tier}</span>
              {names.join(" · ")}
            </p>
          ))}
        </Card>
      )}
    </PublicShell>
  );
}
