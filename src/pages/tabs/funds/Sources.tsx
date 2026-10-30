import { type FormEvent, useState } from "react";
import { Field, toneText } from "../../../components/ui";
import type { CommunityEvent } from "../../../data/types";
import { inr } from "../../../lib/format";
import { fundTotals } from "../../../shared/derive";
import { list, slugId } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId, parseAmount, Section } from "../common";

/** Where the money comes from: the society fund, sponsors, stall fees and dues. */
export function Sources({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const f = fundTotals(ev);
  const own = list(ev, "sources");
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState({ label: "", expected: "" });
  const save = (id: string) => {
    const received = parseAmount(value);
    const s = own.find((x) => x.id === id);
    if (s)
      dispatch({
        type: "updateRecord",
        eventId: ev.id,
        coll: "sources",
        id,
        patch: {
          received,
          tone: received >= s.expected ? "ok" : "due",
          note: received >= s.expected ? "received" : `${inr(s.expected - received)} to collect`,
        },
      });
    setEditing(null);
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const expected = parseAmount(adding.expected);
    if (!adding.label.trim() || !expected) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "sources",
      record: {
        id: slugId(adding.label) || newId("src"),
        label: adding.label.trim(),
        expected,
        received: 0,
        note: "to collect",
        tone: "idle",
      },
    });
    setAdding({ label: "", expected: "" });
  };
  return (
    <Section title="Where the money comes from">
      <ul className="m-0 flex list-none flex-col p-0">
        {f.sources.map((s) => {
          const mine = own.find((x) => x.id === s.id);
          return (
            <li
              key={s.id ?? s.label}
              className="flex flex-col gap-1 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{s.label}</span>
                {editing === s.id ? (
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save(s.id ?? "");
                    }}
                  >
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
                ) : (
                  <span className="tabular">
                    {inr(s.received)} <span className="text-muted">/ {inr(s.expected)}</span>
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className={`text-xs ${toneText(s.tone)}`}>{s.note}</span>
                {editable && mine && editing !== s.id && (
                  <button
                    type="button"
                    className="link text-xs"
                    onClick={() => {
                      setEditing(s.id ?? null);
                      setValue(String(s.received));
                    }}
                  >
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
        })}
      </ul>
      {editable && (
        <form onSubmit={add} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
          <Field label="New source" htmlFor="src-label">
            <input
              id="src-label"
              className="field"
              value={adding.label}
              onChange={(e) => setAdding({ ...adding, label: e.target.value })}
              placeholder="Resident contributions"
            />
          </Field>
          <Field label="Expected" htmlFor="src-exp">
            <input
              id="src-exp"
              className="field"
              inputMode="decimal"
              value={adding.expected}
              onChange={(e) => setAdding({ ...adding, expected: e.target.value })}
            />
          </Field>
          <button
            type="submit"
            className="btn btn-secondary btn-sm h-10"
            disabled={!adding.label.trim() || !parseAmount(adding.expected)}
          >
            Add
          </button>
        </form>
      )}
    </Section>
  );
}
