import { type ReactNode, useState } from "react";
import { detectorClass, Scanner } from "../../components/scanner";
import { fill } from "../../lib/guestText";
import type { LinkText } from "../../lib/linkText/en";
import { type GateView, readPassCode } from "../../shared/public";
import { type Act, PublicShell, useLinkLang } from "./shell";

/** Passes listed at once; a search finds the rest. */
const SHOWN = 40;

type GatePass = GateView["passes"][number];

/** Sets a pass's count inside; its buttons wait until the server has it. */
function useCheckIn(act: Act | undefined) {
  const [busy, setBusy] = useState("");
  const set = async (id: string, count: number) => {
    if (!act) return;
    setBusy(id);
    try {
      await act([{ type: "checkIn", coll: "passes", id, fnId: "day", count }]);
    } finally {
      setBusy("");
    }
  };
  return { busy, set };
}

/** The gate volunteer's page: find a flat or scan its pass, then count people in. */
export function GatePage({ view, act, preview }: { view: GateView; act?: Act; preview?: ReactNode }) {
  const { t, shell } = useLinkLang(view.event);
  const { busy, set } = useCheckIn(act);
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const term = q.trim().toLowerCase();
  const shown = (
    found
      ? view.passes.filter((p) => p.id === found)
      : view.passes.filter((p) => p.name.toLowerCase().includes(term))
  ).slice(0, SHOWN);
  const search = (text: string) => {
    setQ(text);
    setFound(null);
    setNote("");
  };
  const scanned = (text: string) => {
    setScanning(false);
    const pass = view.passes.find((p) => p.id === readPassCode(text));
    if (!pass) {
      setNote(t.notPass);
      return;
    }
    setFound(pass.id);
    setQ("");
    setNote(fill(t.welcomeIn, { name: pass.name, n: pass.checkedIn || pass.count }));
    if (!pass.checkedIn) void set(pass.id, pass.count);
  };
  const count = fill(t.gateCount, { inside: view.inside, issued: view.issued, capacity: view.capacity });
  return (
    <PublicShell
      event={view.event}
      eyebrow={t.gate}
      preview={preview}
      {...shell}
      aside={<span className="mt-2 font-mono text-[28px] text-white tabular">{count}</span>}
    >
      <label htmlFor="gate-q" className="label">
        {t.findPass}
      </label>
      <div className="flex gap-2">
        <input
          id="gate-q"
          className="field flex-1 text-lg"
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder={t.flatOrName}
        />
        {act && detectorClass() && (
          <button type="button" className="btn btn-secondary" onClick={() => setScanning(true)}>
            {t.scanPass}
          </button>
        )}
      </div>
      {note && (
        <p role="status" className="m-0 text-[15px] font-medium text-leaf-ink">
          {note}
        </p>
      )}
      {scanning && (
        <Scanner title={t.scanPass} hint={t.cameraHint} onCode={scanned} onClose={() => setScanning(false)} />
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((p) => (
          <GateRow key={p.id} p={p} t={t} disabled={!act || busy === p.id} onSet={(n) => void set(p.id, n)} />
        ))}
      </ul>
    </PublicShell>
  );
}

interface RowProps {
  p: GatePass;
  t: LinkText;
  disabled: boolean;
  onSet: (n: number) => void;
}

function GateRow({ p, t, disabled, onSet }: RowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
      <span className="flex flex-col">
        <span className="font-semibold">{p.name}</span>
        <span className="text-xs text-muted">{fill(t.inOf, { c: p.checkedIn, n: p.count })}</span>
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label={fill(t.oneLessFor, { name: p.name })}
          disabled={disabled || p.checkedIn <= 0}
          onClick={() => onSet(p.checkedIn - 1)}
        >
          −
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          aria-label={fill(t.oneMoreFor, { name: p.name })}
          disabled={disabled || p.checkedIn >= p.count + 2}
          onClick={() => onSet(p.checkedIn + 1)}
        >
          {t.oneMore}
        </button>
      </span>
    </li>
  );
}
