import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router";
import { TaskRow, useEditable, useTaskToggle } from "../../components/tasks";
import { Pill } from "../../components/ui";
import type { PlannrEvent, Task } from "../../data/types";
import { addDays, dayMonth, daysBetween, TODAY } from "../../lib/dates";
import { inr, plural } from "../../lib/format";
import { buildTimeline, type TimelineEntry, type TimelineKind } from "../../shared/planning";
import { useStore } from "../../store/store";
import { TabPage } from "./common";

type View = "phases" | "list";

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
          {done} of {plural(tasks.length, "task")} done ·{" "}
          {left > 0 ? `${plural(left, "day")} to go` : left === 0 ? "it's today" : "the day has passed"}
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
                {!p.entries.length && (
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
          {e.late ? " · late" : e.done && e.kind !== "function" ? " · done" : ""}
        </span>
      </span>
    </li>
  );
}

type Show = "open" | "done" | "all";

/** Every task, grouped by urgency, with filters by state and by person. */
function TaskList({ ev, onOpenTask }: { ev: PlannrEvent; onOpenTask: (id: string) => void }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const { toggle, ticked } = useTaskToggle(ev);
  const [show, setShow] = useState<Show>("open");
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const tasks = ev.layout === "empty" ? [] : ev.tasks.list;
  const people = [...new Set(tasks.map((t) => t.who))].sort();
  const open = (t: Task) => !t.done || ticked.includes(t.id);
  const shown = tasks
    .filter((t) => (show === "all" ? true : show === "open" ? open(t) : t.done))
    .filter((t) => !who || t.who === who)
    .sort((a, b) => a.due.localeCompare(b.due));
  const week = addDays(TODAY, 7);
  const groups: { label: string; list: Task[] }[] =
    show === "done"
      ? [{ label: "Done", list: shown }]
      : [
          { label: "Overdue", list: shown.filter((t) => !t.done && t.due < TODAY) },
          { label: "This week", list: shown.filter((t) => !t.done && t.due >= TODAY && t.due <= week) },
          { label: "Later", list: shown.filter((t) => !t.done && t.due > week) },
          { label: "Done", list: shown.filter((t) => t.done) },
        ];

  const add = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    dispatch({
      type: "addTask",
      eventId: ev.id,
      task: {
        id: `u${Date.now().toString(36)}`,
        title: clean,
        who: who || "You",
        due: TODAY < ev.date ? TODAY : ev.date,
        done: false,
      },
    });
    setTitle("");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="m-0 flex gap-1.5 border-0 p-0">
          <legend className="sr-only">Show</legend>
          {(["open", "done", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={show === s}
              className="chip chip-sm"
              onClick={() => setShow(s)}
            >
              {s === "open" ? "Open" : s === "done" ? "Done" : "All"}
            </button>
          ))}
        </fieldset>
        {people.length > 1 && (
          <label className="ml-auto flex items-center gap-2 text-sm text-body">
            Who
            <select
              className="field h-9 min-h-0 py-0 appearance-auto"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="tasks-new" className="sr-only">
            New task
          </label>
          <input
            id="tasks-new"
            className="field flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={who ? `Add a task for ${who}` : "Add a task"}
          />
          <button type="submit" className="btn btn-secondary" disabled={!title.trim()}>
            Add
          </button>
        </form>
      )}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <section
            key={g.label}
            aria-label={g.label}
            className="flex flex-col rounded-2xl border border-line bg-surface px-5 pt-3 pb-1"
          >
            <h2 className={`eyebrow pb-1 ${g.label === "Overdue" ? "text-rust-ink" : "text-muted"}`}>
              {g.label} · {g.list.length}
            </h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {g.list.map((t) => (
                <TaskRow
                  key={t.id}
                  ev={ev}
                  task={t}
                  editable={editable}
                  onToggle={toggle}
                  onOpen={(x) => onOpenTask(x.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      {!shown.length && (
        <p className="m-0 rounded-2xl border border-dashed border-line-2 p-8 text-center text-body">
          {show === "done" ? "Nothing ticked off yet." : "Nothing open here. Enjoy the quiet."}
        </p>
      )}
    </>
  );
}
