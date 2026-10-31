import type { PlannrEvent } from "../../../data/types";
import { expectedAt, functionCount } from "../../../shared/derive";
import { functionsOf } from "../../../shared/eventLists";
import { Section } from "../layout";

/** "12 of 300 free", "8 over the 300 seats", or a dash when the venue's capacity isn't known. */
function seatsLeft(expected: number, capacity: number | undefined): string {
  if (!capacity) return "—";
  return expected > capacity
    ? `${expected - capacity} over the ${capacity} seats`
    : `${capacity - expected} of ${capacity} free`;
}

/** Headcount for each function, with the number to give the caterer and the seats left. */
export function FunctionCounts({ ev }: { ev: PlannrEvent }) {
  return (
    <Section title="By function" label="Headcount by function">
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table */}
      <section className="scroll-x" aria-label="Headcount by function table" tabIndex={0}>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Function</th>
              <th className="py-2 text-right font-medium">Invited</th>
              <th className="py-2 text-right font-medium">Coming</th>
              <th className="py-2 text-right font-medium">Waiting</th>
              <th className="py-2 text-right font-medium">Plan for</th>
              <th className="py-2 pl-4 font-medium">Seats</th>
            </tr>
          </thead>
          <tbody>
            {functionsOf(ev).map((f) => {
              const c = functionCount(ev, f.id);
              const plan = expectedAt(c);
              const over = f.capacity && plan > f.capacity;
              return (
                <tr key={f.id} className="border-t border-sand-2">
                  <td className="py-2.5 font-medium">{f.label}</td>
                  <td className="py-2.5 text-right tabular">{c.invited}</td>
                  <td className="py-2.5 text-right tabular text-leaf-ink">{c.yes}</td>
                  <td className="py-2.5 text-right tabular">{c.waiting}</td>
                  <td className="py-2.5 text-right tabular font-semibold">{plan}</td>
                  <td className={`py-2.5 pl-4 text-xs ${over ? "text-rust-ink" : "text-body"}`}>
                    {seatsLeft(plan, f.capacity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <span className="text-xs text-muted">
        “Plan for” counts everyone coming plus 80% of those who haven't answered. Give it to the caterer a
        week before.
      </span>
    </Section>
  );
}
