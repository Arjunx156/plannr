import { type FormEvent, useState } from "react";
import { Field } from "../../../components/fields";
import { toneText } from "../../../components/ui";
import type { FundSource } from "../../../data/communityTypes";
import type { CommunityEvent } from "../../../data/types";
import { inr, parseAmount } from "../../../lib/format";
import { fundTotals } from "../../../shared/balances";
import { slugId } from "../../../shared/eventLists";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

/** A source once `received` is in: settled when it meets what was expected, else what's left to collect. */
function collected(s: FundSource, received: number): Partial<FundSource> {
  const settled = received >= s.expected;
  return {
    received,
    tone: settled ? "ok" : "due",
    note: settled ? "received" : `${inr(s.expected - received)} to collect`,
  };
}

/** Where the money comes from: the society fund, sponsors, stall fees and dues. */
export function Sources({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const own = list(ev, "sources");
  return (
    <Section title="Where the money comes from">
      <ul className="m-0 flex list-none flex-col p-0">
        {fundTotals(ev).sources.map((s) => (
          <SourceRow
            key={s.id ?? s.label}
            ev={ev}
            s={s}
            mine={own.find((x) => x.id === s.id)}
            editable={editable}
          />
        ))}
      </ul>
      {editable && <AddSource ev={ev} />}
    </Section>
  );
}

interface RowProps {
  ev: CommunityEvent;
  s: FundSource;
  /** The planner's own record; sponsor and stall totals are worked out from their lists instead. */
  mine?: FundSource;
  editable: boolean;
}

function SourceRow({ ev, s, mine, editable }: RowProps) {
  const { dispatch } = useStore();
  /** The amount being typed, or null when not editing. */
  const [value, setValue] = useState<string | null>(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (mine?.id && value !== null) {
      const patch = collected(mine, parseAmount(value));
      dispatch({ type: "updateRecord", eventId: ev.id, coll: "sources", id: mine.id, patch });
    }
    setValue(null);
  };
  return (
    <li className="flex flex-col gap-1 border-t border-sand-2 py-2.5 text-sm first:border-0">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{s.label}</span>
        {value === null ? (
          <span className="tabular">
            {inr(s.received)} <span className="text-muted">/ {inr(s.expected)}</span>
          </span>
        ) : (
          <form className="flex gap-1.5" onSubmit={save}>
            <label htmlFor={`src-${s.id}`} className="sr-only">
              Received for {s.label}
            </label>
            <input
              id={`src-${s.id}`}
              className="field h-8 w-28"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm">
              Save
            </button>
          </form>
        )}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className={`text-xs ${toneText(s.tone)}`}>{s.note}</span>
        {editable && mine && value === null && (
          <button type="button" className="link text-xs" onClick={() => setValue(String(s.received))}>
            Update collected
          </button>
        )}
        {!mine && (
          <span className="text-xs text-muted">
            from the {s.id === "sponsors" ? "sponsor list" : "stall list"}
          </span>
        )}
      </span>
    </li>
  );
}

function AddSource({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const [form, setForm] = useState({ label: "", expected: "" });
  const expected = parseAmount(form.expected);
  const label = form.label.trim();
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!label || !expected) return;
    const record = { id: slugId(label) || newId("src"), label, expected, received: 0, note: "to collect" };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "sources", record: { ...record, tone: "idle" } });
    setForm({ label: "", expected: "" });
  };
  return (
    <form onSubmit={add} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
      <Field label="New source" htmlFor="src-label">
        <input
          id="src-label"
          className="field"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Resident contributions"
        />
      </Field>
      <Field label="Expected" htmlFor="src-exp">
        <input
          id="src-exp"
          className="field"
          inputMode="decimal"
          value={form.expected}
          onChange={(e) => setForm({ ...form, expected: e.target.value })}
        />
      </Field>
      <button type="submit" className="btn btn-secondary btn-sm h-10" disabled={!label || !expected}>
        Add
      </button>
    </form>
  );
}
