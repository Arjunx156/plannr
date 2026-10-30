import { type FormEvent, useState } from "react";
import { Modal, TextField } from "../../../components/ui";
import type { FunctionDay, PlannrEvent, RunItem } from "../../../data/types";
import { clock, nowAndNext, runsheetFor } from "../../../shared/derive";
import { toast, useStore } from "../../../store/store";
import { newId, Section } from "../common";
import { useClock } from "./useClock";

/** The live run sheet for one function, with what's on now and a shift for running late. */
export function RunSheet({
  ev,
  fn,
  live,
  editable,
}: {
  ev: PlannrEvent;
  fn: FunctionDay;
  live: boolean;
  editable: boolean;
}) {
  const { dispatch } = useStore();
  const now = useClock();
  const items = runsheetFor(ev, fn.id);
  const { now: current, next } = nowAndNext(items, live ? now : "00:00");
  const [editing, setEditing] = useState<RunItem | "new" | null>(null);
  const anchor = current ?? next[0];
  const done = (r: RunItem, value: boolean) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "runsheet", id: r.id, patch: { done: value } });
  const late = (minutes: number) => {
    if (!anchor) return;
    dispatch({ type: "shiftRunsheet", eventId: ev.id, fnId: fn.id, fromId: anchor.id, minutes });
    dispatch(toast(`Everything from “${anchor.title}” moved ${minutes} minutes later.`));
  };
  return (
    <Section
      title="Run sheet"
      aside={
        <span className="flex items-center gap-2">
          {live && <span className="font-mono text-sm tabular text-muted">{clock(now)}</span>}
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing("new")}>
              + Add
            </button>
          )}
        </span>
      }
    >
      {live && anchor && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl bg-ink p-4 text-white">
            <span className="eyebrow text-stone">{current ? "Now" : "Up next"}</span>
            <span className="font-serif text-[26px] leading-tight">{anchor.title}</span>
            <span className="text-sm text-stone">
              {clock(anchor.time)}
              {anchor.owner ? ` · ${anchor.owner}` : ""}
            </span>
            {editable && (
              <button
                type="button"
                className="btn btn-sm mt-2 self-start bg-white text-ink"
                onClick={() => done(anchor, true)}
              >
                Done
              </button>
            )}
          </div>
          {editable && (
            <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
              <span className="font-semibold">Running late?</span>
              <span className="text-sm text-body">Moves “{anchor.title}” and everything after it.</span>
              <span className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 30].map((m) => (
                  <button key={m} type="button" className="btn btn-secondary btn-sm" onClick={() => late(m)}>
                    +{m} min
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      )}
      <ol className="m-0 flex list-none flex-col p-0">
        {items.map((r) => (
          <RunRow
            key={r.id}
            item={r}
            now={live && r.id === current?.id}
            editable={editable}
            onDone={(checked) => done(r, checked)}
            onEdit={() => setEditing(r)}
          />
        ))}
        {!items.length && (
          <li className="text-sm text-muted">
            Nothing on the run sheet for {fn.label} yet. Add the timings and who's in charge of each.
          </li>
        )}
      </ol>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add to the run sheet" : "Edit"}
      >
        {editing && (
          <RunItemForm
            key={editing === "new" ? "new" : editing.id}
            ev={ev}
            fn={fn}
            item={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Section>
  );
}

/** Who's in charge (with a call link when there's a number), and any note. */
function RunOwner({ item: r }: { item: RunItem }) {
  if (!r.owner && !r.note) return null;
  return (
    <span className="text-xs text-muted">
      {r.owner}
      {r.owner && r.phone && (
        <>
          {" · "}
          <a href={`tel:${r.phone}`} className="link">
            call
          </a>
        </>
      )}
      {r.note ? `${r.owner ? " · " : ""}${r.note}` : ""}
    </span>
  );
}

/** One run-sheet item: tick it off, see who runs it; the one happening now is highlighted. */
function RunRow({
  item: r,
  now,
  editable,
  onDone,
  onEdit,
}: {
  item: RunItem;
  now: boolean;
  editable: boolean;
  onDone: (done: boolean) => void;
  onEdit: () => void;
}) {
  return (
    <li
      className={`grid grid-cols-[24px_64px_minmax(0,1fr)_auto] items-start gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0 ${now ? "bg-peacock-tint" : ""}`}
    >
      <input
        type="checkbox"
        aria-label={`${r.title} done`}
        checked={!!r.done}
        disabled={!editable}
        onChange={(e) => onDone(e.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <span className={`tabular ${r.done ? "text-muted line-through" : "font-semibold"}`}>
        {clock(r.time)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={r.done ? "text-muted line-through" : ""}>{r.title}</span>
        <RunOwner item={r} />
      </span>
      {editable && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label={`Edit ${r.title}`}
          onClick={onEdit}
        >
          Edit
        </button>
      )}
    </li>
  );
}

function RunItemForm({
  ev,
  fn,
  item,
  onDone,
}: {
  ev: PlannrEvent;
  fn: FunctionDay;
  item?: RunItem;
  onDone: () => void;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState({
    time: item?.time ?? "10:00",
    title: item?.title ?? "",
    owner: item?.owner ?? "",
    phone: item?.phone ?? "",
    note: item?.note ?? "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.time) return;
    const record: RunItem = {
      id: item?.id ?? newId("r"),
      fnId: fn.id,
      time: form.time,
      title: form.title.trim(),
      ...(form.owner.trim() ? { owner: form.owner.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
      ...(item?.done ? { done: true } : {}),
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "runsheet", record });
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <TextField
          id="ri-time"
          label="Time"
          value={form.time}
          onChange={(time) => setForm({ ...form, time })}
          type="time"
        />
        <TextField
          id="ri-title"
          label="What happens"
          value={form.title}
          onChange={(title) => setForm({ ...form, title })}
          placeholder="Baraat arrives"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id="ri-owner"
          label="Who's in charge"
          value={form.owner}
          onChange={(owner) => setForm({ ...form, owner })}
        />
        <TextField
          id="ri-phone"
          label="Their phone"
          value={form.phone}
          onChange={(phone) => setForm({ ...form, phone })}
          inputMode="tel"
        />
      </div>
      <TextField
        id="ri-note"
        label="Note"
        value={form.note}
        onChange={(note) => setForm({ ...form, note })}
      />
      <span className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={!form.title.trim()}>
          Save
        </button>
        {item && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: "removeRecord", eventId: ev.id, coll: "runsheet", id: item.id });
              onDone();
            }}
          >
            Remove
          </button>
        )}
      </span>
    </form>
  );
}
