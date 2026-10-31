import type { JSX } from "react";
import { Panel, Pill, StatTile, toneText } from "../../components/ui";
import { WatchList } from "../../components/watch";
import type { PersonalEvent } from "../../data/types";
import { shortDate, TODAY } from "../../lib/dates";
import { inr, inrShort, pct } from "../../lib/format";
import { budgetTotals, personalReadiness } from "../../lib/metrics";
import { rsvpSummary, vendorSummary } from "../../shared/derive";
import { SpendBar } from "../tabs/money/SpendBar";
import { Notices } from "./Notices";
import { Tasks } from "./Tasks";

/** The overview of a wedding or birthday: notices, tasks, vendors and the budget at a glance. */
export function Personal({
  ev,
  onOpenTask,
}: {
  ev: PersonalEvent;
  onOpenTask: (id: string) => void;
}): JSX.Element {
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
          fill="peacock"
        />
        <StatTile
          label="Budget"
          value={inrShort(t.spent)}
          sub={`spent of ${inrShort(t.total)} · projected ${inrShort(t.projected)}`}
          bar={t.spent / Math.max(1, t.total)}
          fill={t.over > 0 ? "rust" : "leaf"}
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
          fill="marigold"
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
                <span className="text-body text-xs">
                  {shortDate(f.date)}
                  {f.time || f.part ? ` · ${f.time || f.part}` : ""}
                </span>
                {f.place && <span className="text-muted text-xs">{f.place}</span>}
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
            <span className="text-rust-ink text-xs">{ev.vendors.note}</span>
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
        {items.length > 0 ? (
          items.map((v) => (
            <Pill key={v} tone={tone}>
              {v}
            </Pill>
          ))
        ) : (
          <span className="text-muted text-sm">None</span>
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
        <span className={`font-semibold text-sm ${t.over > 0 ? "text-rust-ink" : "text-leaf-ink"}`}>
          {t.over > 0 ? `${inr(t.over)} over plan` : `${inr(-t.over)} headroom`}
        </span>
      }
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable) */}
      <section className="scroll-x" aria-label="Budget by category" tabIndex={0}>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-muted text-xs">
              <th className="py-2 font-medium">Category</th>
              <th className="w-[38%] py-2 font-medium">Planned vs projected</th>
              <th className="py-2 text-right font-medium">Planned</th>
              <th className="py-2 text-right font-medium">Spent</th>
              <th className="py-2 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ev.budget.categories.map((c) => {
              return (
                <tr key={c.id} className="border-sand-2 border-t">
                  <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                  <td className="py-2.5 pr-3">
                    <SpendBar c={c} max={max} />
                  </td>
                  <td className="tabular py-2.5 text-right">{inr(c.planned)}</td>
                  <td className="tabular py-2.5 text-right">{inr(c.spent)}</td>
                  <td className={`py-2.5 pl-3 text-xs ${toneText(c.tone)}`}>{c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <span className="text-muted text-xs">{ev.budget.source}</span>
    </Panel>
  );
}
