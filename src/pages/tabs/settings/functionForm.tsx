import { type FormEvent, type ReactNode, useState } from "react";
import { TextField } from "../../../components/fields";
import type { FunctionDay, Task } from "../../../data/baseTypes";
import type { PlannrEvent } from "../../../data/types";
import { addDays, daysBetween } from "../../../lib/dates";
import { plural } from "../../../lib/format";
import type { EventAction } from "../../../shared/engine";
import { functionsOf } from "../../../shared/eventLists";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";

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
interface FormState {
  label: string;
  date: string;
  time: string;
  place: string;
  address: string;
  dress: string;
  capacity: string;
  private: boolean;
}
type Setter = <K extends keyof FormState>(key: K) => (value: FormState[K]) => void;

const formFor = (ev: PlannrEvent, fn?: FunctionDay): FormState => ({
  label: fn?.label ?? "",
  date: fn?.date ?? ev.date,
  time: fn?.time ?? "",
  place: fn?.place ?? "",
  address: fn?.address ?? "",
  dress: fn?.dress ?? "",
  capacity: fn?.capacity ? String(fn.capacity) : "",
  private: !!fn?.private,
});

/** Adds a function, or edits one; moving its date can move its open tasks with it. */
export function FunctionForm({
  ev,
  fn,
  onClose,
}: {
  ev: PlannrEvent;
  fn?: FunctionDay;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState(() => formFor(ev, fn));
  const set: Setter = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const tasks = ev.layout === "empty" ? [] : ev.tasks.list.filter((t) => fn && t.fn === fn.id && !t.done);
  const [moveTasks, setMoveTasks] = useState(true);
  const shift = fn ? daysBetween(fn.date, form.date) : 0;
  const ready = form.label.trim() && form.date;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    const record = functionRecord(fn?.id ?? newId("fn"), { ...form, capacity: Number(form.capacity) });
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
      <FunctionFields form={form} set={set}>
        {shift !== 0 && tasks.length > 0 && (
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
      </FunctionFields>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={!ready}>
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

/** The function's fields; `children` sits under the date, where a date change asks about its tasks. */
function FunctionFields({ form, set, children }: { form: FormState; set: Setter; children: ReactNode }) {
  return (
    <>
      <TextField
        id="fn-label"
        label="Name"
        value={form.label}
        onChange={set("label")}
        placeholder="Mehendi"
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="fn-date" label="Date" type="date" value={form.date} onChange={set("date")} />
        <TextField id="fn-time" label="Time" value={form.time} onChange={set("time")} placeholder="6:00 pm" />
      </div>
      {children}
      <TextField id="fn-place" label="Venue" value={form.place} onChange={set("place")} />
      <TextField id="fn-address" label="Address for the map" value={form.address} onChange={set("address")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="fn-dress" label="Dress code" value={form.dress} onChange={set("dress")} />
        <TextField
          id="fn-cap"
          label="Seats"
          inputMode="numeric"
          value={form.capacity}
          onChange={(v) => set("capacity")(v.replace(/\D/g, ""))}
        />
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={form.private}
          onChange={(e) => set("private")(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-leaf)]"
        />
        Family only: keep it off the website
      </label>
    </>
  );
}
