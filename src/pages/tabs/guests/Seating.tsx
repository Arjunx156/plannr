import { type DragEvent, useState } from "react";
import { useEditable } from "../../../components/tasks";
import type { Household, PlannrEvent } from "../../../data/types";
import { functionsOf, list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId, Section } from "../common";

/** Tables and who sits where, by drag and drop or by picking a table from a list. */
export function Seating({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const tables = list(ev, "tables");
  const fns = functionsOf(ev);
  const seated = fns.filter((f) => tables.some((t) => t.fnId === f.id));
  const [fnId, setFnId] = useState(seated[0]?.id ?? fns[fns.length - 1]?.id ?? "");
  const [drag, setDrag] = useState<string | null>(null);
  const households = list(ev, "households").filter(
    (h) => h.functions.includes(fnId) && h.rsvp[fnId]?.status !== "no",
  );
  const here = tables.filter((t) => t.fnId === fnId);
  const people = (h: Household) =>
    h.rsvp[fnId]?.status === "yes" ? (h.rsvp[fnId]?.count ?? h.expected) : h.expected;
  const atTable = (tid: string) => households.filter((h) => h.tables?.[fnId] === tid);
  const unseated = households.filter(
    (h) => !h.tables?.[fnId] || !here.some((t) => t.id === h.tables?.[fnId]),
  );

  const seat = (hid: string, tid: string | undefined) => {
    const h = households.find((x) => x.id === hid);
    if (!h) return;
    const next = { ...h.tables };
    if (tid) next[fnId] = tid;
    else delete next[fnId];
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "households", id: hid, patch: { tables: next } });
  };

  const addTables = (n: number) => {
    const start = here.length;
    for (let i = 0; i < n; i++)
      dispatch({
        type: "addRecord",
        eventId: ev.id,
        coll: "tables",
        record: { id: newId("t"), fnId, name: `Table ${start + i + 1}`, seats: 10 },
      });
  };

  const onDrop = (tid: string | undefined) => (e: DragEvent) => {
    e.preventDefault();
    const hid = e.dataTransfer.getData("text/plain") || drag;
    if (hid) seat(hid, tid);
    setDrag(null);
  };

  return (
    <Section
      title="Seating"
      aside={
        fns.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-body">
            For
            <select
              className="field h-9 min-h-0 appearance-auto py-0 text-sm"
              value={fnId}
              onChange={(e) => setFnId(e.target.value)}
            >
              {fns.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      {!here.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-body">
          <span>
            No tables for this function yet.{" "}
            {households.length
              ? `${Math.ceil(households.reduce((s, h) => s + people(h), 0) / 10)} tables of 10 would seat everyone invited.`
              : ""}
          </span>
          {editable && households.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addTables(Math.ceil(households.reduce((s, h) => s + people(h), 0) / 10))}
            >
              Add tables of 10
            </button>
          )}
        </div>
      ) : (
        <>
          <span className="text-xs text-muted">
            Drag a household onto a table, or choose its table from the list. Counts use their RSVP when
            they've answered.
          </span>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; each household also has a table picker */}
          <div
            className="flex min-h-12 flex-wrap gap-1.5 rounded-xl border border-dashed border-line-2 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop(undefined)}
            title="Not seated yet"
          >
            <span className="eyebrow w-full text-muted">
              Not seated · {unseated.reduce((s, h) => s + people(h), 0)} people
            </span>
            {unseated.map((h) => (
              <SeatChip
                key={h.id}
                h={h}
                people={people(h)}
                tables={here}
                editable={editable}
                onSeat={(tid) => seat(h.id, tid)}
                onDrag={setDrag}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {here.map((t) => {
              const guests = atTable(t.id);
              const used = guests.reduce((s, h) => s + people(h), 0);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; each household also has a table picker
                <div
                  key={t.id}
                  className={`flex min-h-24 flex-col gap-1.5 rounded-xl border p-2.5 ${used > t.seats ? "border-rust-line bg-rust-tint" : "border-line bg-paper"}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop(t.id)}
                >
                  <span className="flex justify-between text-xs font-semibold">
                    {t.name}
                    <span className={used > t.seats ? "text-rust-ink" : "text-muted"}>
                      {used}/{t.seats}
                    </span>
                  </span>
                  {guests.map((h) => (
                    <SeatChip
                      key={h.id}
                      h={h}
                      people={people(h)}
                      tables={here}
                      editable={editable}
                      onSeat={(tid) => seat(h.id, tid)}
                      onDrag={setDrag}
                      current={t.id}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {editable && (
            <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => addTables(1)}>
              + Add a table
            </button>
          )}
        </>
      )}
    </Section>
  );
}

function SeatChip({
  h,
  people,
  tables,
  editable,
  onSeat,
  onDrag,
  current,
}: {
  h: Household;
  people: number;
  tables: { id: string; name: string }[];
  editable: boolean;
  onSeat: (tid: string | undefined) => void;
  onDrag: (id: string | null) => void;
  current?: string;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; the table picker inside does the same by keyboard
    <span
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", h.id);
        onDrag(h.id);
      }}
      className="flex items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-xs shadow-[0_1px_2px_rgba(0,0,0,.06)]"
    >
      <span className="min-w-0 flex-1 truncate" title={h.name}>
        {h.name} · {people}
      </span>
      {editable && (
        <select
          aria-label={`Table for ${h.name}`}
          className="max-w-[90px] rounded border border-line bg-paper text-[11px]"
          value={current ?? ""}
          onChange={(e) => onSeat(e.target.value || undefined)}
        >
          <option value="">No table</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}
