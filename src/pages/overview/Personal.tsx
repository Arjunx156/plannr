import { Panel, Pill, StatTile, toneText } from "../../components/ui";
import { WatchList } from "../../components/watch";
import type { PersonalEvent } from "../../data/types";
import { shortDate, TODAY } from "../../lib/dates";
import { inr, inrShort, pct } from "../../lib/format";
import { budgetTotals, personalReadiness } from "../../lib/metrics";
import { rsvpSummary, vendorSummary } from "../../shared/derive";
import { Notices } from "./Notices";
import { Tasks } from "./Tasks";

/** The overview of a wedding or birthday: notices, tasks, vendors and the budget at a glance. */
export function Personal({ ev, onOpenTask }: { ev: PersonalEvent; onOpenTask: (id: string) => void }) {
  const r = personalReadiness(ev, TODAY);
  const t = budgetTotals(ev.budget);
  const rsvp = rsvpSummary(ev);
  const vendors = vendorSummary(ev);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Readiness"
          value={`${pct(r.overall, 1)}%`}
          sub={r.overdue ? `${r.overdue} overdue ${r.overdue === 1 ? "task" : "tasks"}` : ev.pace}
          bar={r.overall}
          color="var(--color-peacock)"
        />
        <StatTile
          label="Budget"
          value={inrShort(t.spent)}
          sub={`spent of ${inrShort(t.total)} · projected ${inrShort(t.projected)}`}
          bar={t.spent / Math.max(1, t.total)}
          color={t.over > 0 ? "var(--color-rust)" : "var(--color-leaf)"}
        />
        <StatTile
          label="Tasks"
          value={`${r.tasksDone}/${r.tasksTotal}`}
          sub={`${ev.tasks.list.filter((x) => !x.done).length} open on the list`}
          bar={r.tasks}
        />
        <StatTile
          label="Guests"
          value={`${rsvp.confirmed}`}
          sub={`confirmed of ${rsvp.total} · ${rsvp.pending} waiting`}
          bar={r.guests}
          color="var(--color-marigold)"
        />
      </div>
      <WatchList ev={ev} />
      <Notices ev={ev} />
      {ev.functions.length > 0 && (
        <Panel title="Functions">
          <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {ev.functions.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 rounded-xl bg-sand p-3">
                <span className="font-semibold">{f.label}</span>
                <span className="text-xs text-body">
                  {shortDate(f.date)}
                  {f.time || f.part ? ` · ${f.time || f.part}` : ""}
                </span>
                {f.place && <span className="text-xs text-muted">{f.place}</span>}
              </li>
            ))}
          </ol>
        </Panel>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Tasks ev={ev} onOpenTask={onOpenTask} />
        <Panel title="Vendors">
          <VendorGroup label="Booked" items={vendors.booked} tone="ok" />
          <VendorGroup label="In conversation" items={vendors.talking} tone="due" />
          <VendorGroup label="Still to book" items={vendors.needed} tone="idle" />
          {ev.vendors.note && vendors.talking.includes("Photography") && (
            <span className="text-xs text-rust-ink">{ev.vendors.note}</span>
          )}
        </Panel>
      </div>
      <Budget ev={ev} />
    </>
  );
}

function VendorGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "ok" | "due" | "idle";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow text-muted">
        {label} · {items.length}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((v) => (
            <Pill key={v} tone={tone}>
              {v}
            </Pill>
          ))
        ) : (
          <span className="text-sm text-muted">None</span>
        )}
      </div>
    </div>
  );
}

function Budget({ ev }: { ev: PersonalEvent }) {
  const t = budgetTotals(ev.budget);
  const max = Math.max(...ev.budget.categories.map((c) => Math.max(c.planned, c.projected ?? 0)), 1);
  return (
    <Panel
      title="Budget"
      aside={
        <span className={`text-sm font-semibold ${t.over > 0 ? "text-rust-ink" : "text-leaf-ink"}`}>
          {t.over > 0 ? `${inr(t.over)} over plan` : `${inr(-t.over)} headroom`}
        </span>
      }
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable) */}
      <section className="scroll-x" aria-label="Budget by category" tabIndex={0}>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Category</th>
              <th className="w-[38%] py-2 font-medium">Planned vs projected</th>
              <th className="py-2 text-right font-medium">Planned</th>
              <th className="py-2 text-right font-medium">Spent</th>
              <th className="py-2 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ev.budget.categories.map((c) => {
              const proj = c.projected ?? c.planned;
              return (
                <tr key={c.id} className="border-t border-sand-2">
                  <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                  <td className="py-2.5 pr-3">
                    <div className="relative h-2 rounded-[2px] bg-sand-2">
                      <span
                        className="absolute inset-y-0 left-0 rounded-[2px]"
                        style={{ width: `${(c.planned / max) * 100}%`, background: "var(--color-line-2)" }}
                      />
                      <span
                        className="absolute inset-y-0 left-0 rounded-[2px]"
                        style={{
                          width: `${(Math.min(c.spent, proj) / max) * 100}%`,
                          background: proj > c.planned ? "var(--color-rust)" : "var(--color-leaf)",
                        }}
                      />
                      {proj > c.planned && (
                        <span
                          className="absolute inset-y-0 rounded-r-[2px] opacity-40"
                          style={{
                            left: `${(c.planned / max) * 100}%`,
                            width: `${((proj - c.planned) / max) * 100}%`,
                            background: "var(--color-rust)",
                          }}
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular">{inr(c.planned)}</td>
                  <td className="py-2.5 text-right tabular">{inr(c.spent)}</td>
                  <td className={`py-2.5 pl-3 text-xs ${toneText(c.tone)}`}>{c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <span className="text-xs text-muted">{ev.budget.source}</span>
    </Panel>
  );
}
