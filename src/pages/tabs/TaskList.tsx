import { type FormEvent, useState } from "react";
import { useEditable, useTaskToggle } from "../../components/taskHooks";
import { TaskRow } from "../../components/tasks";
import type { Task } from "../../data/baseTypes";
import type { PlannrEvent } from "../../data/types";
import { addDays, TODAY } from "../../lib/dates";
import { useStore } from "../../store/store";

type Show = "open" | "done" | "all";

const SHOW_LABEL: Record<Show, string> = { open: "Open", done: "Done", all: "All" };
/** Which tasks each view lists; `open` counts a task ticked off in this visit as still open. */
const SHOWS: Record<Show, (t: Task, open: boolean) => boolean> = {
  open: (_, open) => open,
  done: (t) => t.done,
  all: () => true,
};

interface Group {
  label: string;
  list: Task[];
}

/** Open tasks by urgency (overdue, this week, later), then the done ones. */
function groupsFor(shown: Task[], show: Show): Group[] {
  if (show === "done") return [{ label: "Done", list: shown }];
  const week = addDays(TODAY, 7);
  const open = shown.filter((t) => !t.done);
  return [
    { label: "Overdue", list: open.filter((t) => t.due < TODAY) },
    { label: "This week", list: open.filter((t) => t.due >= TODAY && t.due <= week) },
    { label: "Later", list: open.filter((t) => t.due > week) },
    { label: "Done", list: shown.filter((t) => t.done) },
  ];
}

/** Every task, grouped by urgency, with filters by state and by person. */
export function TaskList({ ev, onOpenTask }: { ev: PlannrEvent; onOpenTask: (id: string) => void }) {
  const editable = useEditable(ev);
  const { toggle, ticked } = useTaskToggle(ev);
  const [show, setShow] = useState<Show>("open");
  const [who, setWho] = useState("");
  const tasks = ev.layout === "empty" ? [] : ev.tasks.list;
  const people = [...new Set(tasks.map((t) => t.who))].sort();
  const open = (t: Task) => !t.done || ticked.includes(t.id);
  const shown = tasks
    .filter((t) => SHOWS[show](t, open(t)))
    .filter((t) => !who || t.who === who)
    .sort((a, b) => a.due.localeCompare(b.due));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ShowPicker value={show} onChange={setShow} />
        {people.length > 1 && <WhoPicker people={people} value={who} onChange={setWho} />}
      </div>
      {editable && <AddTask ev={ev} who={who} />}
      {groupsFor(shown, show)
        .filter((g) => g.list.length > 0)
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
      {shown.length === 0 && (
        <p className="m-0 rounded-2xl border border-dashed border-line-2 p-8 text-center text-body">
          {show === "done" ? "Nothing ticked off yet." : "Nothing open here. Enjoy the quiet."}
        </p>
      )}
    </>
  );
}

function ShowPicker({ value, onChange }: { value: Show; onChange: (show: Show) => void }) {
  return (
    <fieldset className="m-0 flex gap-1.5 border-0 p-0">
      <legend className="sr-only">Show</legend>
      {(["open", "done", "all"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          className="chip chip-sm"
          onClick={() => onChange(s)}
        >
          {SHOW_LABEL[s]}
        </button>
      ))}
    </fieldset>
  );
}

function WhoPicker({
  people,
  value,
  onChange,
}: {
  people: string[];
  value: string;
  onChange: (who: string) => void;
}) {
  return (
    <label className="ml-auto flex items-center gap-2 text-sm text-body">
      Who
      <select
        className="field h-9 min-h-0 py-0 appearance-auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Everyone</option>
        {people.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Adds a task for the person being looked at, or for "You", due today (or on the day, if that's sooner). */
function AddTask({ ev, who }: { ev: PlannrEvent; who: string }) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const due = TODAY < ev.date ? TODAY : ev.date;
    const task = { id: `u${Date.now().toString(36)}`, title: clean, who: who || "You", due, done: false };
    dispatch({ type: "addTask", eventId: ev.id, task });
    setTitle("");
  };
  return (
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
  );
}
