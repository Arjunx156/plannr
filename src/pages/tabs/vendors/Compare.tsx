import { Pill } from "../../../components/ui";
import type { PlannrEvent, Quote, Vendor } from "../../../data/types";
import { inr, plural } from "../../../lib/format";
import { quoteTotal } from "../../../shared/derive";
import { list } from "../../../shared/records";
import { Section } from "../common";
import { guestsOf } from "./shared";

/** Quotes for one category side by side, totalled for this guest count. */
export function Compare({
  ev,
  category,
  editable,
  onBook,
  onOpen,
}: {
  ev: PlannrEvent;
  category: string;
  editable: boolean;
  onBook: (v: Vendor, q: Quote) => void;
  onOpen: (id: string) => void;
}) {
  const guests = guestsOf(ev);
  const rows = list(ev, "vendors")
    .filter((v) => v.category === category)
    .flatMap((v) => v.quotes.map((q) => ({ v, b: { q, total: quoteTotal(q.amount, q.perGuest, guests) } })))
    .sort((a, b) => a.b.total - b.b.total);
  const cheapest = rows[0]?.b.total ?? 0;
  const booked = rows.find(
    (r) => r.v.stage === "booked" && (!r.v.chosenQuote || r.v.chosenQuote === r.b.q.id),
  );
  return (
    <Section
      title={`${category}: side by side`}
      aside={
        booked ? (
          <Pill tone="ok">booked {booked.v.name || booked.b.q.label}</Pill>
        ) : (
          <span className="text-sm text-muted">{plural(rows.length, "quote")}</span>
        )
      }
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table */}
      <section className="scroll-x" aria-label={`${category} quotes`} tabIndex={0}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Vendor</th>
              <th className="py-2 pl-3 text-right font-medium">Quote</th>
              <th className="py-2 pl-4 text-right font-medium">{guests ? `For ${guests}` : "Total"}</th>
              <th className="py-2 pl-4 font-medium">Includes</th>
              <th className="py-2 font-medium">Terms</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, b }) => {
              const firm = b.q.label.includes("·")
                ? (b.q.label.split("·")[0]?.trim() ?? "")
                : v.name || v.category;
              const pkg = b.q.label.includes("·")
                ? b.q.label.split("·").slice(1).join("·").trim()
                : b.q.label;
              const isBooked = v.stage === "booked" && (!v.chosenQuote || v.chosenQuote === b.q.id);
              return (
                <tr key={`${v.id}-${b.q.id}`} className="border-t border-sand-2 align-top">
                  <td className="py-2.5 pr-3">
                    <button type="button" className="link text-left font-medium" onClick={() => onOpen(v.id)}>
                      {firm}
                    </button>
                    {pkg && pkg !== firm && <span className="block text-xs text-muted">{pkg}</span>}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular whitespace-nowrap">
                    {inr(b.q.amount)}
                    {b.q.perGuest ? <span className="block text-xs text-muted">a plate</span> : null}
                  </td>
                  <td
                    className={`py-2.5 pl-4 text-right tabular font-semibold whitespace-nowrap ${b.total === cheapest ? "text-leaf-ink" : ""}`}
                  >
                    {inr(b.total)}
                    {b.total !== cheapest && (
                      <span className="block text-xs font-normal text-muted">+{inr(b.total - cheapest)}</span>
                    )}
                  </td>
                  <td className="max-w-[220px] py-2.5 pl-4 text-xs text-body">{b.q.inclusions ?? "—"}</td>
                  <td className="max-w-[200px] py-2.5 text-xs text-body">{b.q.terms ?? "—"}</td>
                  <td className="py-2.5 pl-2 text-right">
                    {isBooked ? (
                      <Pill tone="ok">booked</Pill>
                    ) : (
                      editable &&
                      !booked && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={`Book ${firm}`}
                          onClick={() => onBook(v, b.q)}
                        >
                          Book…
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </Section>
  );
}
