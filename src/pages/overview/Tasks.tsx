import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { TaskRow, useEditable, useTaskToggle } from "../../components/tasks";
import { Panel } from "../../components/ui";
import type { CommunityEvent, PersonalEvent, Task } from "../../data/types";
import { TODAY } from "../../lib/dates";
import { tasksDone } from "../../lib/metrics";
import { useStore } from "../../store/store";

/** The overview's short task list: open tasks first, soonest due first, with quick add. */
export function Tasks({
  ev,
  onOpenTask,
}: {
  ev: PersonalEvent | CommunityEvent;
  onOpenTask: (id: string) => void;
}) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const { toggle, ticked } = useTaskToggle(ev);
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const settled = (t: Task) => t.done && !ticked.includes(t.id);
  const list = [...ev.tasks.list].sort(
    (a, b) => Number(settled(a)) - Number(settled(b)) || a.due.localeCompare(b.due),
  );
  const visible = showDone ? list : list.filter((t) => !settled(t));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const task: Task = {
      id: `u${Date.now().toString(36)}`,
      title: clean,
      who: "You",
      due: TODAY < ev.date ? TODAY : ev.date,
      done: false,
    };
    dispatch({ type: "addTask", eventId: ev.id, task });
    setTitle("");
  };
  return (
    <Panel
      title="Tasks"
      aside={
        <span className="flex gap-3">
          <button type="button" className="link text-xs" onClick={() => setShowDone((s) => !s)}>
            {showDone ? "Hide done" : `Show done (${ev.tasks.list.filter((t) => t.done).length})`}
          </button>
          <Link to={`/events/${ev.id}/tasks`} className="link text-xs">
            All tasks
          </Link>
        </span>
      }
    >
      <span className="text-xs text-muted">
        {tasksDone(ev.tasks)} of {ev.tasks.total} done across the whole plan
      </span>
      <ul className="m-0 flex list-none flex-col p-0">
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            ev={ev}
            task={t}
            editable={editable}
            onToggle={toggle}
            onOpen={(x) => onOpenTask(x.id)}
          />
        ))}
        {!visible.length && <li className="py-2 text-sm text-muted">Nothing open. Enjoy the quiet.</li>}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor={`new-task-${ev.id}`} className="sr-only">
            New task
          </label>
          <input
            id={`new-task-${ev.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task"
            className="field flex-1"
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!title.trim()}>
            Add
          </button>
        </form>
      )}
    </Panel>
  );
}
