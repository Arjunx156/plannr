import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router";
import type { PlannrEvent, Task } from "../data/types";
import { api } from "../lib/api";
import { dueLabel } from "../lib/dates";
import { timeAgo } from "../lib/format";
import type { CommentView } from "../shared/types";
import { canEdit, toast, useStore } from "../store/store";
import { Field, Modal } from "./ui";

/** Whether this person may change the plan: always in the demo, by role with an account. */
export function useEditable(ev: PlannrEvent | undefined): boolean {
  const { state } = useStore();
  if (!ev || state.mode !== "account") return true;
  return canEdit(state.remote[ev.id]?.role);
}

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
}) {
  const due = dueLabel(task.due);
  const id = `task-${ev.id}-${task.id}`;
  return (
    <li className="flex items-start gap-3 border-t border-sand-2 py-2.5">
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
            className={`text-left text-sm font-medium hover:underline hover:underline-offset-4 ${task.done ? "text-muted line-through" : ""}`}
          >
            {task.title}
          </button>
        ) : (
          <label htmlFor={id} className={`text-sm font-medium ${task.done ? "text-muted line-through" : ""}`}>
            {task.title}
          </label>
        )}
        <span className="text-xs text-muted">
          {showEvent && (
            <>
              <Link to={`/events/${ev.id}`} className="link text-xs text-muted">
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
        className={`shrink-0 text-xs font-medium ${due.late && !task.done ? "text-rust-ink" : "text-body"}`}
      >
        {due.text}
      </span>
    </li>
  );
}

/**
 * Ticking a task keeps it in place, struck through, for the rest of the visit, so the tick
 * stays visible and can be undone from the toast.
 */
export function useTaskToggle(ev: PlannrEvent | undefined) {
  const { dispatch } = useStore();
  const [ticked, setTicked] = useState<string[]>([]);
  const toggle = (t: Task) => {
    if (!ev) return;
    setTicked((prev) => (prev.includes(t.id) ? prev : [...prev, t.id]));
    dispatch({ type: "toggleTask", eventId: ev.id, taskId: t.id });
    if (!t.done) dispatch(toast(`Done: ${t.title}`, { type: "toggleTask", eventId: ev.id, taskId: t.id }));
  };
  return { toggle, ticked };
}

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

/** A record's comments: loading, empty, or the list. */
function CommentList({ list }: { list: CommentView[] | null }) {
  if (list === null) return <span className="text-sm text-muted">Loading…</span>;
  if (!list.length)
    return (
      <span className="text-sm text-muted">
        No comments yet. Ask a question or leave a note for the others.
      </span>
    );
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {list.map((c) => (
        <li key={c.id} className="flex flex-col gap-0.5 rounded-xl bg-sand px-3 py-2.5">
          <span className="text-xs text-muted">
            <strong className="font-semibold text-ink">{c.by ?? "Someone"}</strong> · {timeAgo(c.at)}
          </span>
          <span className="text-sm whitespace-pre-wrap">{c.body}</span>
        </li>
      ))}
    </ul>
  );
}

function Comments({
  eventId,
  recordType,
  recordId,
}: {
  eventId: string;
  recordType: string;
  recordId: string;
}) {
  const { dispatch } = useStore();
  const [list, setList] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .comments(eventId, recordType, recordId)
      .then((c) => live && setList(c))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [eventId, recordType, recordId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const c = await api.addComment(eventId, recordType, recordId, text);
      setList((l) => [...(l ?? []), c]);
      setBody("");
    } catch (err) {
      dispatch(toast(`Couldn't post that: ${(err as Error).message}`));
    }
    setBusy(false);
  };

  return (
    <section aria-label="Comments" className="flex flex-col gap-3">
      <h3 className="font-serif text-lg">Comments</h3>
      <CommentList list={list} />
      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor={`comment-${recordId}`} className="sr-only">
          Add a comment
        </label>
        <textarea
          id={`comment-${recordId}`}
          className="field min-h-16 py-2.5"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
        />
        <button type="submit" className="btn btn-secondary btn-sm self-start" disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Comment"}
        </button>
      </form>
    </section>
  );
}
