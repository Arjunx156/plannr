import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill } from "../../components/ui";
import type { FunctionDay, PlannrEvent, Task } from "../../data/types";
import { addDays, daysBetween, longDate } from "../../lib/dates";
import { plural } from "../../lib/format";
import type { EventAction } from "../../shared/engine";
import { functionsOf, list } from "../../shared/records";
import { toast, useStore } from "../../store/store";
import { newId, Section, TabPage } from "./common";
import { SaveTemplate } from "./Templates";

export function SettingsTab({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  return (
    <TabPage eyebrow={ev.name} title="Settings">
      <Basics ev={ev} editable={editable} />
      <Functions ev={ev} editable={editable} />
      <Memory ev={ev} editable={editable} />
      <SaveTemplate ev={ev} />
      <Archive ev={ev} editable={editable} />
    </TabPage>
  );
}

function Basics({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(ev.name);
  const [date, setDate] = useState(ev.date);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== ev.name)
      dispatch({ type: "updateEvent", eventId: ev.id, patch: { name: name.trim() } });
    if (date && date !== ev.date) dispatch({ type: "updateEvent", eventId: ev.id, patch: { date } });
    dispatch(toast("Saved."));
  };
  return (
    <Section title="The event">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label="Name" htmlFor="ev-name">
          <input
            id="ev-name"
            className="field"
            value={name}
            disabled={!editable}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Main date" htmlFor="ev-date">
          <input
            id="ev-date"
            type="date"
            className="field"
            value={date}
            disabled={!editable}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        {editable && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={(!name.trim() || name === ev.name) && date === ev.date}
          >
            Save
          </button>
        )}
      </form>
    </Section>
  );
}

function Functions({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const fns = functionsOf(ev);
  const current = open === "new" ? undefined : fns.find((f) => f.id === open);
  return (
    <Section
      title="Functions"
      aside={
        editable && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen("new")}>
            + Add a function
          </button>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {fns.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-2 py-2.5 first:border-0"
          >
            <span className="flex flex-col text-sm">
              <span className="font-semibold">
                {f.label} {f.private && <Pill tone="idle">family only</Pill>}
              </span>
              <span className="text-xs text-muted">
                {longDate(f.date)}
                {f.time ? ` · ${f.time}` : ""}
                {f.place ? ` · ${f.place}` : ""}
                {f.capacity ? ` · seats ${f.capacity}` : ""}
              </span>
            </span>
            {editable && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(f.id)}>
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={current ? `Edit ${current.label}` : "Add a function"}
        width={520}
      >
        {open && <FunctionForm key={open} ev={ev} fn={current} onClose={() => setOpen(null)} />}
      </Modal>
    </Section>
  );
}

type FunctionFields = Omit<FunctionDay, "id" | "capacity" | "private"> & {
  capacity: number;
  private: boolean;
};

/** The function as saved: text trimmed, and blank optional fields left out rather than stored empty. */
function functionRecord(id: string, f: FunctionFields): FunctionDay {
  const optional = (value: string | undefined) => value?.trim() || undefined;
  const record: FunctionDay = { id, label: f.label.trim(), date: f.date };
  const time = optional(f.time);
  const place = optional(f.place);
  const address = optional(f.address);
  const dress = optional(f.dress);
  return {
    ...record,
    ...(time && { time }),
    ...(place && { place }),
    ...(address && { address }),
    ...(dress && { dress }),
    ...(f.capacity > 0 && { capacity: f.capacity }),
    ...(f.private && { private: true }),
  };
}

/** Saving a function: the record itself, and its open tasks moved by `moveBy` days. */
function saveFunctionActions(
  eventId: string,
  fn: FunctionDay | undefined,
  record: FunctionDay,
  tasks: Task[],
  moveBy: number,
): EventAction[] {
  const saved: EventAction = fn
    ? {
        type: "updateRecord",
        eventId,
        coll: "functions",
        id: fn.id,
        // An edit that unticks "family only" has to clear the flag, not just leave it out.
        patch: { ...record, private: !!record.private },
      }
    : { type: "addRecord", eventId, coll: "functions", record };
  if (!moveBy) return [saved];
  return [
    saved,
    ...tasks.map(
      (t): EventAction => ({
        type: "updateTask",
        eventId,
        taskId: t.id,
        patch: { due: addDays(t.due, moveBy) },
      }),
    ),
  ];
}

/** Removing a function also takes it off every household's invitation. */
function removeFunctionActions(ev: PlannrEvent, fn: FunctionDay): EventAction[] {
  const invited = list(ev, "households").filter((h) => h.functions.includes(fn.id));
  return [
    { type: "removeRecord", eventId: ev.id, coll: "functions", id: fn.id },
    ...invited.map(
      (h): EventAction => ({
        type: "updateRecord",
        eventId: ev.id,
        coll: "households",
        id: h.id,
        patch: { functions: h.functions.filter((f) => f !== fn.id) },
      }),
    ),
  ];
}

/** "3 days later", "1 day earlier". */
function shiftText(days: number): string {
  const n = Math.abs(days);
  return `${n} ${n === 1 ? "day" : "days"} ${days > 0 ? "later" : "earlier"}`;
}

function FunctionForm({ ev, fn, onClose }: { ev: PlannrEvent; fn?: FunctionDay; onClose: () => void }) {
  const { dispatch } = useStore();
  const [label, setLabel] = useState(fn?.label ?? "");
  const [date, setDate] = useState(fn?.date ?? ev.date);
  const [time, setTime] = useState(fn?.time ?? "");
  const [place, setPlace] = useState(fn?.place ?? "");
  const [address, setAddress] = useState(fn?.address ?? "");
  const [dress, setDress] = useState(fn?.dress ?? "");
  const [capacity, setCapacity] = useState(fn?.capacity ? String(fn.capacity) : "");
  const [priv, setPriv] = useState(!!fn?.private);
  const tasks = ev.layout === "empty" ? [] : ev.tasks.list.filter((t) => fn && t.fn === fn.id && !t.done);
  const [moveTasks, setMoveTasks] = useState(true);
  const shift = fn ? daysBetween(fn.date, date) : 0;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !date) return;
    const record = functionRecord(fn?.id ?? newId("fn"), {
      label,
      date,
      time,
      place,
      address,
      dress,
      capacity: Number(capacity),
      private: priv,
    });
    // The tasks for a function move with it, so nothing is left due on the wrong day.
    const moveBy = fn && moveTasks ? shift : 0;
    for (const action of saveFunctionActions(ev.id, fn, record, tasks, moveBy)) dispatch(action);
    dispatch(toast(fn ? `Saved ${record.label}.` : `Added ${record.label}.`));
    onClose();
  };

  const remove = () => {
    if (!fn) return;
    for (const action of removeFunctionActions(ev, fn)) dispatch(action);
    dispatch(toast(`Removed ${fn.label}.`));
    onClose();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3" noValidate>
      <Field label="Name" htmlFor="fn-label">
        <input
          id="fn-label"
          className="field"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Mehendi"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="fn-date">
          <input
            id="fn-date"
            type="date"
            className="field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Time" htmlFor="fn-time">
          <input
            id="fn-time"
            className="field"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="6:00 pm"
          />
        </Field>
      </div>
      {fn && shift !== 0 && tasks.length > 0 && (
        <label className="flex items-center gap-2.5 rounded-xl bg-peacock-wash p-3 text-sm">
          <input
            type="checkbox"
            checked={moveTasks}
            onChange={(e) => setMoveTasks(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-peacock)]"
          />
          Move its {plural(tasks.length, "open task")} {shiftText(shift)} too
        </label>
      )}
      <Field label="Venue" htmlFor="fn-place">
        <input id="fn-place" className="field" value={place} onChange={(e) => setPlace(e.target.value)} />
      </Field>
      <Field label="Address for the map" htmlFor="fn-address">
        <input
          id="fn-address"
          className="field"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dress code" htmlFor="fn-dress">
          <input id="fn-dress" className="field" value={dress} onChange={(e) => setDress(e.target.value)} />
        </Field>
        <Field label="Seats" htmlFor="fn-cap">
          <input
            id="fn-cap"
            className="field"
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={priv}
          onChange={(e) => setPriv(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-leaf)]"
        />
        Family only: keep it off the website
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={!label.trim() || !date}>
          {fn ? "Save" : "Add function"}
        </button>
        {fn && functionsOf(ev).length > 1 && (
          <button type="button" className="btn btn-ghost text-rust-ink" onClick={remove}>
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

/** Things the family wants every suggestion to respect. The assistant reads these first. */
function Memory({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const notes = list(ev, "memory");
  const [text, setText] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "memory",
      record: { id: newId("m"), text: text.trim() },
    });
    setText("");
  };
  return (
    <Section title="What Plannr remembers">
      <p className="m-0 text-sm text-body">
        Every suggestion respects these: dietary rules, accessibility, what's not up for change.
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {notes.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 border-t border-sand-2 py-2 text-sm first:border-0"
          >
            <span>◆ {m.text}</span>
            {editable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Forget “${m.text}”`}
                onClick={() => dispatch({ type: "removeRecord", eventId: ev.id, coll: "memory", id: m.id })}
              >
                Forget
              </button>
            )}
          </li>
        ))}
        {!notes.length && (
          <li className="text-sm text-muted">
            Nothing yet. Try “No alcohol” or “Ammachi uses a wheelchair”.
          </li>
        )}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="mem-text" className="sr-only">
            Something to remember
          </label>
          <input
            id="mem-text"
            className="field flex-1"
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Keep the mandapam décor as quoted"
          />
          <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>
            Remember
          </button>
        </form>
      )}
    </Section>
  );
}

function Archive({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  if (!editable) return null;
  return (
    <Section title={ev.archived ? "Archived" : "When it's over"}>
      <p className="m-0 text-sm text-body">
        Archiving moves the event to Past events. Everything is kept, shared links stop working, and you can
        restore it any time.
      </p>
      <button
        type="button"
        className="btn btn-outline self-start"
        onClick={() => {
          dispatch({ type: "archiveEvent", eventId: ev.id, archived: !ev.archived });
          dispatch(toast(ev.archived ? "Restored." : "Archived."));
          if (!ev.archived) navigate("/events");
        }}
      >
        {ev.archived ? "Restore the event" : "Archive the event"}
      </button>
    </Section>
  );
}
