import type { PersonalEvent } from "../../../data/types";
import { longDate, TODAY } from "../../../lib/dates";
import { inr } from "../../../lib/format";
import { settleUp, splitBalances } from "../../../shared/balances";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

/** Where one side stands against its fair share: even, ahead, or behind. */
function balanceLine(balance: number): { color: string; text: string } {
  if (Math.abs(balance) < 1) return { color: "text-leaf-ink", text: "Even" };
  if (balance > 0) return { color: "text-body", text: `Paid ${inr(balance)} more than their share` };
  return { color: "text-rust-ink", text: `${inr(-balance)} behind their share` };
}

/** How costs are shared between the families, and who owes whom to settle up. */
export function Split({ ev, editable }: { ev: PersonalEvent; editable: boolean }) {
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
            <span className={`text-xs ${balanceLine(b.balance).color}`}>{balanceLine(b.balance).text}</span>
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
