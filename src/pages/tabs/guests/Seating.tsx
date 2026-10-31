import { type DragEvent, useState } from "react";
import { useEditable } from "../../../components/taskHooks";
import type { FunctionDay } from "../../../data/baseTypes";
import type { Household, SeatTable } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { functionsOf } from "../../../shared/eventLists";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

const TABLE_SEATS = 10;

/** Seats a household needs at a function: its answer once it has said yes, its invitation before. */
function seatsFor(h: Household, fnId: string): number {
  const answer = h.rsvp[fnId];
  return answer?.status === "yes" ? answer.count : h.expected;
}

const total = (hs: Household[], fnId: string) => hs.reduce((s, h) => s + seatsFor(h, fnId), 0);

/** Seating a household at a table, or none, and adding tables for the function. */
function useSeatActions(ev: PlannrEvent, fnId: string, households: Household[], here: SeatTable[]) {
  const { dispatch } = useStore();
  const seat = (hid: string, tid: string | undefined) => {
    const h = households.find((x) => x.id === hid);
    if (!h) return;
    const next = { ...h.tables };
    if (tid) next[fnId] = tid;
    else delete next[fnId];
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "households", id: hid, patch: { tables: next } });
  };
  const addTables = (n: number) => {
    for (let i = 0; i < n; i++) {
      const record = { id: newId("t"), fnId, name: `Table ${here.length + i + 1}`, seats: TABLE_SEATS };
      dispatch({ type: "addRecord", eventId: ev.id, coll: "tables", record });
    }
  };
  return { seat, addTables };
}

interface Chips {
  fnId: string;
  tables: SeatTable[];
  editable: boolean;
  onSeat: (hid: string, tid: string | undefined) => void;
  onDrag: (id: string | null) => void;
}

/** Tables and who sits where, by drag and drop or by picking a table from a list. */
export function Seating({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  const tables = list(ev, "tables");
  const fns = functionsOf(ev);
  const seated = fns.filter((f) => tables.some((t) => t.fnId === f.id));
  const [fnId, setFnId] = useState(seated[0]?.id ?? fns.at(-1)?.id ?? "");
  const [drag, setDrag] = useState<string | null>(null);
  const households = list(ev, "households").filter(
    (h) => h.functions.includes(fnId) && h.rsvp[fnId]?.status !== "no",
  );
  const here = tables.filter((t) => t.fnId === fnId);
  const { seat, addTables } = useSeatActions(ev, fnId, households, here);
  const chips: Chips = { fnId, tables: here, editable, onSeat: seat, onDrag: setDrag };
  const unseated = households.filter((h) => !here.some((t) => t.id === h.tables?.[fnId]));

  const onDrop = (tid: string | undefined) => (e: DragEvent) => {
    e.preventDefault();
    const hid = e.dataTransfer.getData("text/plain") || drag;
    if (hid) seat(hid, tid);
    setDrag(null);
  };

  return (
    <Section
      title="Seating"
      aside={fns.length > 1 && <FunctionSelect fns={fns} value={fnId} onChange={setFnId} />}
    >
      {here.length === 0 ? (
        <NoTables
          invited={households.length}
          needed={Math.ceil(total(households, fnId) / TABLE_SEATS)}
          editable={editable}
          onAdd={addTables}
        />
      ) : (
        <>
          <span className="text-xs text-muted">
            Drag a household onto a table, or choose its table from the list. Counts use their RSVP when
            they've answered.
          </span>
          <Unseated households={unseated} chips={chips} onDrop={onDrop(undefined)} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {here.map((t) => (
              <TableCard
                key={t.id}
                table={t}
                guests={households.filter((h) => h.tables?.[fnId] === t.id)}
                chips={chips}
                onDrop={onDrop(t.id)}
              />
            ))}
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

function FunctionSelect({
  fns,
  value,
  onChange,
}: {
  fns: FunctionDay[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-body">
      For
      <select
        className="field h-9 min-h-0 appearance-auto py-0 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {fns.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface NoTablesProps {
  invited: number;
  needed: number;
  editable: boolean;
  onAdd: (n: number) => void;
}

function NoTables({ invited, needed, editable, onAdd }: NoTablesProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-body">
      <span>
        No tables for this function yet.{" "}
        {invited > 0 ? `${needed} tables of ${TABLE_SEATS} would seat everyone invited.` : ""}
      </span>
      {editable && invited > 0 && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAdd(needed)}>
          Add tables of {TABLE_SEATS}
        </button>
      )}
    </div>
  );
}

function Unseated({
  households,
  chips,
  onDrop,
}: {
  households: Household[];
  chips: Chips;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; each household also has a table picker
    <div
      className="flex min-h-12 flex-wrap gap-1.5 rounded-xl border border-dashed border-line-2 p-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      title="Not seated yet"
    >
      <span className="eyebrow w-full text-muted">Not seated · {total(households, chips.fnId)} people</span>
      {households.map((h) => (
        <SeatChip key={h.id} h={h} chips={chips} />
      ))}
    </div>
  );
}

interface TableProps {
  table: SeatTable;
  guests: Household[];
  chips: Chips;
  onDrop: (e: DragEvent) => void;
}

function TableCard({ table, guests, chips, onDrop }: TableProps) {
  const used = total(guests, chips.fnId);
  const over = used > table.seats;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a shortcut; each household also has a table picker
    <div
      className={`flex min-h-24 flex-col gap-1.5 rounded-xl border p-2.5 ${over ? "border-rust-line bg-rust-tint" : "border-line bg-paper"}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <span className="flex justify-between text-xs font-semibold">
        {table.name}
        <span className={over ? "text-rust-ink" : "text-muted"}>
          {used}/{table.seats}
        </span>
      </span>
      {guests.map((h) => (
        <SeatChip key={h.id} h={h} chips={chips} current={table.id} />
      ))}
    </div>
  );
}

function SeatChip({ h, chips, current }: { h: Household; chips: Chips; current?: string }) {
  const { fnId, tables, editable, onSeat, onDrag } = chips;
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
        {h.name} · {seatsFor(h, fnId)}
      </span>
      {editable && (
        <select
          aria-label={`Table for ${h.name}`}
          className="max-w-[90px] rounded border border-line bg-paper text-xs"
          value={current ?? ""}
          onChange={(e) => onSeat(h.id, e.target.value || undefined)}
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
