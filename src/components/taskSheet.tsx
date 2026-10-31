import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import type { Task } from "../data/baseTypes";
import type { PlannrEvent } from "../data/types";
import { toast, useStore } from "../store/store";
import { Comments } from "./comments";
import { Field } from "./fields";
import { Modal } from "./overlays";
import { useEditable } from "./taskHooks";

/** One task, open beside the page: edit it, and talk about it with co-planners. */
export function TaskSheet({
  ev,
  taskId,
  onClose,
}: {
  ev: PlannrEvent;
  taskId: string | null;
  onClose: () => void;
}) {
  const { state } = useStore();
  const editable = useEditable(ev);
  const task = ev.layout === "empty" ? undefined : ev.tasks.list.find((t) => t.id === taskId);
  return (
    <Modal open={!!task} onClose={onClose} title="Task" side="right" width={460}>
      {task && (
        <>
          {/* Keyed by task, so opening another task starts from its own values. */}
          <TaskForm key={task.id} ev={ev} task={task} editable={editable} onClose={onClose} />
          <hr className="m-0 border-0 border-t border-line" />
          {state.mode === "account" ? (
            <Comments eventId={ev.id} recordType="task" recordId={task.id} />
          ) : (
            <p className="m-0 text-sm text-body">
              With an account, co-planners can talk about each task right here.{" "}
              <Link to="/signup" className="link">
                Create one
              </Link>
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function TaskForm({
  ev,
  task,
  editable,
  onClose,
}: {
  ev: PlannrEvent;
  task: Task;
  editable: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState(task.title);
  const [who, setWho] = useState(task.who);
  const [due, setDue] = useState(task.due);
  const [note, setNote] = useState(task.note ?? "");

  const patch: Partial<Omit<Task, "id">> = {};
  if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
  if (who.trim() && who.trim() !== task.who) patch.who = who.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(due) && due !== task.due) patch.due = due;
  if (note.trim() !== (task.note ?? "")) patch.note = note.trim() || undefined;
  const changed = Object.keys(patch).length > 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!changed) return onClose();
    dispatch({ type: "updateTask", eventId: ev.id, taskId: task.id, patch });
    dispatch(toast(`Saved “${patch.title ?? task.title}”.`));
    onClose();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3.5">
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={task.done}
          disabled={!editable}
          onChange={() => dispatch({ type: "toggleTask", eventId: ev.id, taskId: task.id })}
          className="h-4 w-4 accent-[var(--color-leaf)]"
        />
        {task.done ? "Done" : "Not done yet"}
      </label>
      <Field label="Title" htmlFor="task-title">
        <input
          id="task-title"
          className="field"
          value={title}
          disabled={!editable}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Who" htmlFor="task-who">
          <input
            id="task-who"
            className="field"
            value={who}
            disabled={!editable}
            onChange={(e) => setWho(e.target.value)}
          />
        </Field>
        <Field label="Due" htmlFor="task-due">
          <input
            id="task-due"
            type="date"
            className="field"
            value={due}
            disabled={!editable}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Note" htmlFor="task-note">
        <textarea
          id="task-note"
          className="field min-h-20 py-2.5"
          value={note}
          disabled={!editable}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Context, a phone number, what it depends on"
        />
      </Field>
      {editable && (
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={!changed}>
            Save changes
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
