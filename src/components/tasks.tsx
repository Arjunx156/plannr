import type { JSX } from "react";
import { Link } from "react-router";
import type { Task } from "../data/baseTypes";
import type { PlannrEvent } from "../data/types";
import { dueLabel } from "../lib/dates";

/** One task: tick it off, see when it's due, open it for details. */
export function TaskRow({
  ev,
  task,
  editable,
  onToggle,
  onOpen,
  showEvent = false,
}: {
  ev: PlannrEvent;
  task: Task;
  editable: boolean;
  onToggle: (t: Task) => void;
  onOpen?: (t: Task) => void;
  showEvent?: boolean;
}): JSX.Element {
  const due = dueLabel(task.due);
  const id = `task-${ev.id}-${task.id}`;
  return (
    <li className="flex items-start gap-3 border-sand-2 border-t py-2.5">
      <input
        type="checkbox"
        id={id}
        checked={task.done}
        disabled={!editable}
        aria-label={task.title}
        onChange={() => onToggle(task)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-leaf)]"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(task)}
            className={`text-left font-medium text-sm hover:underline hover:underline-offset-4 ${task.done ? "text-muted line-through" : ""}`}
          >
            {task.title}
          </button>
        ) : (
          <label htmlFor={id} className={`font-medium text-sm ${task.done ? "text-muted line-through" : ""}`}>
            {task.title}
          </label>
        )}
        <span className="text-muted text-xs">
          {showEvent && (
            <>
              <Link to={`/events/${ev.id}`} className="link text-muted text-xs">
                {ev.name}
              </Link>
              {" · "}
            </>
          )}
          {task.who}
          {task.note ? ` · ${task.note}` : ""}
        </span>
      </span>
      <span
        className={`shrink-0 font-medium text-xs ${due.late && !task.done ? "text-rust-ink" : "text-body"}`}
      >
        {due.text}
      </span>
    </li>
  );
}
