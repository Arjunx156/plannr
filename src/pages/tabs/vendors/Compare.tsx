import { Pill } from "../../../components/ui";
import type { PlannrEvent } from "../../../data/types";
import type { Quote, Vendor } from "../../../data/vendorTypes";
import { inr, plural } from "../../../lib/format";
import { quoteTotal } from "../../../shared/derive";
import { list } from "../../../shared/records";
import { Section } from "../layout";
import { guestsOf } from "./shared";

/** Whether this quote is the one the vendor was booked on (a booking with no quote chosen counts for all). */
function isBookedQuote(v: Vendor, quoteId: string): boolean {
  return v.stage === "booked" && (!v.chosenQuote || v.chosenQuote === quoteId);
}

/** A shortlisted quote from another firm reads "Firm · package"; otherwise the firm is the vendor. */
function quoteParts(label: string, vendor: Vendor): { firm: string; pkg: string } {
  if (!label.includes("·")) return { firm: vendor.name || vendor.category, pkg: label };
  const [firm = "", ...rest] = label.split("·");
  return { firm: firm.trim(), pkg: rest.join("·").trim() };
}

/** One quote: firm and package, price, total against the cheapest, what it includes, and booking it. */
function QuoteRow({
  vendor: v,
  quote: q,
  total,
  cheapest,
  canBook,
  onBook,
  onOpen,
}: {
  vendor: Vendor;
  quote: Quote;
  total: number;
  cheapest: number;
  canBook: boolean;
  onBook: () => void;
  onOpen: () => void;
}) {
  const { firm, pkg } = quoteParts(q.label, v);
  const isBooked = isBookedQuote(v, q.id);
  return (
    <tr className="border-t border-sand-2 align-top">
      <td className="py-2.5 pr-3">
        <button type="button" className="link text-left font-medium" onClick={onOpen}>
          {firm}
        </button>
        {pkg && pkg !== firm && <span className="block text-xs text-muted">{pkg}</span>}
      </td>
      <td className="py-2.5 pl-3 text-right tabular whitespace-nowrap">
        {inr(q.amount)}
        {q.perGuest ? <span className="block text-xs text-muted">a plate</span> : null}
      </td>
      <td
        className={`py-2.5 pl-4 text-right tabular font-semibold whitespace-nowrap ${total === cheapest ? "text-leaf-ink" : ""}`}
      >
        {inr(total)}
        {total !== cheapest && (
          <span className="block text-xs font-normal text-muted">+{inr(total - cheapest)}</span>
        )}
      </td>
      <td className="max-w-[220px] py-2.5 pl-4 text-xs text-body">{q.inclusions ?? "—"}</td>
      <td className="max-w-[200px] py-2.5 text-xs text-body">{q.terms ?? "—"}</td>
      <td className="py-2.5 pl-2 text-right">
        {isBooked && <Pill tone="ok">booked</Pill>}
        {!isBooked && canBook && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label={`Book ${firm}`}
            onClick={onBook}
          >
            Book…
          </button>
        )}
      </td>
    </tr>
  );
}

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
  const booked = rows.find((r) => isBookedQuote(r.v, r.b.q.id));
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
            {rows.map(({ v, b }) => (
              <QuoteRow
                key={`${v.id}-${b.q.id}`}
                vendor={v}
                quote={b.q}
                total={b.total}
                cheapest={cheapest}
                canBook={editable && !booked}
                onBook={() => onBook(v, b.q)}
                onOpen={() => onOpen(v.id)}
              />
            ))}
          </tbody>
        </table>
      </section>
    </Section>
  );
}
