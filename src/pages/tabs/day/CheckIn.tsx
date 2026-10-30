import { useState } from "react";
import { detectorClass, Scanner } from "../../../components/scanner";
import type { FunctionDay, PlannrEvent, RsvpStatus } from "../../../data/types";
import { plural } from "../../../lib/format";
import { checkInCount, comingCount } from "../../../shared/derive";
import { readEntryCode, readPassCode } from "../../../shared/public";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { Section } from "../common";

/** Guest check-in at the door, by name or by scanning an entry QR code. */
/** What a household said for this function. */
function answerText(a: { status: RsvpStatus; count: number } | undefined): string {
  if (a?.status === "yes") return `${a.count} coming`;
  return a?.status === "no" ? "said they can't come" : "didn't answer";
}

export function CheckIn({ ev, fn, editable }: { ev: PlannrEvent; fn: FunctionDay; editable: boolean }) {
  const { dispatch } = useStore();
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const invited = list(ev, "households").filter((h) => h.functions.includes(fn.id));
  if (!invited.length) return null;
  const { inside, expected } = checkInCount(ev, fn.id);
  const term = q.trim().toLowerCase();
  const shown = (
    found
      ? invited.filter((h) => h.id === found)
      : invited.filter((h) => !term || h.name.toLowerCase().includes(term) || h.phone?.endsWith(term))
  )
    .sort((a, b) => Number(!!b.rsvp[fn.id]?.count) - Number(!!a.rsvp[fn.id]?.count))
    .slice(0, 12);
  const set = (id: string, count: number) =>
    dispatch({ type: "checkIn", eventId: ev.id, coll: "households", id, fnId: fn.id, count });
  const scanned = (text: string) => {
    const id = readEntryCode(text);
    const h = id ? invited.find((x) => x.id === id) : undefined;
    setScanning(false);
    if (!h) {
      dispatch(toast("That code isn't an invitation to this function."));
      return;
    }
    setFound(h.id);
    setQ("");
    const coming = h.rsvp[fn.id]?.status === "yes" ? h.rsvp[fn.id]?.count : comingCount(h);
    if (!h.checkedIn?.[fn.id]) set(h.id, coming || h.expected);
    dispatch(toast(`Welcome, ${h.name}: ${plural(coming || h.expected, "person", "people")} checked in.`));
  };
  return (
    <Section
      title="Check-in"
      aside={
        <span className="font-serif text-[24px] tabular">
          {inside} <span className="text-base text-muted">/ {expected}</span>
        </span>
      }
    >
      <div className="flex gap-2">
        <label htmlFor="ci-q" className="sr-only">
          Find a family
        </label>
        <input
          id="ci-q"
          className="field flex-1"
          placeholder="Name or last digits of the phone"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFound(null);
          }}
        />
        {editable && detectorClass() && (
          <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>
            Scan
          </button>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((h) => {
          const a = h.rsvp[fn.id];
          const n = h.checkedIn?.[fn.id] ?? 0;
          return (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{h.name}</span>
                <span className="text-xs text-muted">
                  {answerText(a)}
                  {n ? ` · ${n} in` : ""}
                </span>
              </span>
              {editable && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`One less for ${h.name}`}
                    disabled={n <= 0}
                    onClick={() => set(h.id, n - 1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center tabular">{n}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`One more in for ${h.name}`}
                    disabled={n >= h.expected + 2}
                    onClick={() => set(h.id, n + 1)}
                  >
                    +
                  </button>
                  {!n && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => set(h.id, a?.status === "yes" ? a.count : h.expected)}
                    >
                      All in
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">
        Guests who said yes have an entry code on their invitation page.
        {detectorClass() ? "" : " Scanning works in Chrome on Android; elsewhere, search by name."}
      </span>
      {scanning && <Scanner onCode={scanned} onClose={() => setScanning(false)} />}
    </Section>
  );
}

/** Community passes at the gate: scan the printed QR, or find the flat or name. */
export function PassCheckIn({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const passes = list(ev, "passes");
  if (!passes.length) return null;
  const inside = passes.reduce((s, p) => s + (p.checkedIn ?? 0), 0);
  const issued = passes.reduce((s, p) => s + p.count, 0);
  const term = q.trim().toLowerCase();
  const shown = (
    found
      ? passes.filter((p) => p.id === found)
      : passes.filter((p) => !term || p.name.toLowerCase().includes(term))
  ).slice(0, 12);
  const set = (id: string, count: number) =>
    dispatch({ type: "checkIn", eventId: ev.id, coll: "passes", id, fnId: "day", count });
  const scanned = (text: string) => {
    setScanning(false);
    const pass = passes.find((p) => p.id === readPassCode(text));
    if (!pass) {
      dispatch(toast("That code isn't a pass for this event."));
      return;
    }
    setFound(pass.id);
    setQ("");
    if (!pass.checkedIn) set(pass.id, pass.count);
    dispatch(toast(`Welcome, ${pass.name}: ${pass.checkedIn || pass.count} in.`));
  };
  return (
    <Section
      title="Gate"
      aside={
        <span className="font-serif text-[24px] tabular">
          {inside} <span className="text-base text-muted">/ {issued}</span>
        </span>
      }
    >
      <div className="flex gap-2">
        <label htmlFor="gate-pass-q" className="sr-only">
          Find a pass
        </label>
        <input
          id="gate-pass-q"
          className="field flex-1"
          placeholder="Flat number or name"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setFound(null);
          }}
        />
        {editable && detectorClass() && (
          <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>
            Scan
          </button>
        )}
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((p) => {
          const n = p.checkedIn ?? 0;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted">
                  {n} of {p.count} in
                </span>
              </span>
              {editable && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label={`One less for ${p.name}`}
                    disabled={n <= 0}
                    onClick={() => set(p.id, n - 1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`One more in for ${p.name}`}
                    disabled={n >= p.count + 2}
                    onClick={() => set(p.id, n + 1)}
                  >
                    +
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">
        Print the passes from Stalls & passes; each has a QR code.
        {detectorClass() ? "" : " Scanning works in Chrome on Android; elsewhere, search by flat or name."}
      </span>
      {scanning && <Scanner title="Scan a pass" onCode={scanned} onClose={() => setScanning(false)} />}
    </Section>
  );
}
