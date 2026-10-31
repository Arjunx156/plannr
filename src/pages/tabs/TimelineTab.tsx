import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useEditable, useTaskToggle } from "../../components/taskHooks";
import { TaskRow } from "../../components/tasks";
import { Pill } from "../../components/ui";
import type { PlannrEvent } from "../../data/types";
import { dayMonth, daysBetween, TODAY } from "../../lib/dates";
import { inr, plural } from "../../lib/format";
import { buildTimeline, type TimelineEntry, type TimelineKind } from "../../shared/planning";
import { TabPage } from "./layout";
import { TaskList } from "./TaskList";

type View = "phases" | "list";

/** "12 days to go", "it's today" or "the day has passed". */
function countdownText(daysLeft: number): string {
  if (daysLeft > 0) return `${plural(daysLeft, "day")} to go`;
  return daysLeft === 0 ? "it's today" : "the day has passed";
}

/** /events/:id/timeline — the plan in date order: what's due, what to book, what to pay, and the day itself. */
export function TimelineTab({ ev, onOpenTask }: { ev: PlannrEvent; onOpenTask: (id: string) => void }) {
  const [view, setView] = useState<View>("phases");
  const tasks = ev.layout === "empty" ? [] : ev.tasks.list;
  const done = tasks.filter((t) => t.done).length;
  const left = daysBetween(TODAY, ev.date);
  return (
    <TabPage
      eyebrow={ev.name}
      title="Timeline"
      aside={
        <span className="text-sm text-body">
          {done} of {plural(tasks.length, "task")} done · {countdownText(left)}
        </span>
      }
    >
      <fieldset className="m-0 flex gap-1.5 border-0 p-0">
        <legend className="sr-only">View</legend>
        <button
          type="button"
          className="chip chip-sm"
          aria-pressed={view === "phases"}
          onClick={() => setView("phases")}
        >
          By phase
        </button>
        <button
          type="button"
          className="chip chip-sm"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          Task list
        </button>
      </fieldset>
      {view === "phases" ? (
        <Phases ev={ev} onOpenTask={onOpenTask} />
      ) : (
        <TaskList ev={ev} onOpenTask={onOpenTask} />
      )}
    </TabPage>
  );
}

const KIND_LABEL: Record<TimelineKind, string> = {
  task: "Task",
  payment: "Payment",
  booking: "Book",
  function: "The day",
};

/** Where each kind of entry is handled. */
const KIND_TAB: Record<Exclude<TimelineKind, "task">, string> = {
  payment: "budget",
  booking: "vendors",
  function: "day",
};

function Phases({ ev, onOpenTask }: { ev: PlannrEvent; onOpenTask: (id: string) => void }) {
  const editable = useEditable(ev);
  const { toggle } = useTaskToggle(ev);
  // The plan is replaced, never mutated, so the event itself is the cache key.
  const phases = useMemo(() => buildTimeline(ev, TODAY), [ev]);
  const taskById = new Map((ev.layout === "empty" ? [] : ev.tasks.list).map((t) => [t.id, t]));
  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {phases.map((p) => {
        const late = p.entries.filter((e) => e.late).length;
        return (
          <li key={p.id}>
            <section
              aria-label={p.label}
              className={`flex flex-col rounded-2xl border bg-surface px-5 pt-3 pb-1 ${p.current ? "border-ink" : "border-line"}`}
            >
              <h2 className="flex flex-wrap items-center gap-2 pb-1">
                <span className="eyebrow text-muted">{p.label}</span>
                {p.current && <Pill tone="due">you are here</Pill>}
                {late > 0 && <Pill tone="warn">{late} late</Pill>}
              </h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {p.entries.map((e) => {
                  const task = e.kind === "task" && e.refId ? taskById.get(e.refId) : undefined;
                  return task ? (
                    <TaskRow
                      key={e.key}
                      ev={ev}
                      task={task}
                      editable={editable}
                      onToggle={toggle}
                      onOpen={(x) => onOpenTask(x.id)}
                    />
                  ) : (
                    <EntryRow key={e.key} ev={ev} entry={e} />
                  );
                })}
                {p.entries.length === 0 && (
                  <li className="border-t border-sand-2 py-2.5 text-sm text-muted">
                    Nothing due in this stretch.
                  </li>
                )}
              </ul>
            </section>
          </li>
        );
      })}
    </ol>
  );
}

/** " · late", " · done" (functions are never "done"), or nothing. */
function entryState(e: TimelineEntry): string {
  if (e.late) return " · late";
  return e.done && e.kind !== "function" ? " · done" : "";
}

function EntryRow({ ev, entry: e }: { ev: PlannrEvent; entry: TimelineEntry }) {
  const tab = e.kind === "task" ? "timeline" : KIND_TAB[e.kind];
  return (
    <li className="flex items-start gap-3 border-t border-sand-2 py-2.5">
      <span className="w-[64px] shrink-0 pt-0.5 text-xs tabular text-muted">{dayMonth(e.date)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to={`/events/${ev.id}/${tab}`}
          className={`text-sm font-medium hover:underline hover:underline-offset-4 ${e.done ? "text-muted line-through" : ""}`}
        >
          {e.title}
          {e.amount ? ` · ${inr(e.amount)}` : ""}
        </Link>
        <span className={`text-xs ${e.late ? "text-rust-ink" : "text-muted"}`}>
          {KIND_LABEL[e.kind]}
          {entryState(e)}
        </span>
      </span>
    </li>
  );
}
