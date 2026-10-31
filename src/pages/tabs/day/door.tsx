import { useState } from "react";
import { detectorClass } from "../../../components/scanner";

/** Rows the door shows at once; a search narrows to the rest. */
export const DOOR_ROWS = 12;

/** What's typed at the door, and the one entry a scan picked out, which replaces the search. */
export function useFinder() {
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  return {
    q,
    term: q.trim().toLowerCase(),
    found,
    scanning,
    setScanning,
    search: (text: string) => {
      setQ(text);
      setFound(null);
    },
    pick: (id: string) => {
      setFound(id);
      setQ("");
    },
  };
}

interface FinderProps {
  id: string;
  label: string;
  placeholder: string;
  finder: ReturnType<typeof useFinder>;
  canScan: boolean;
}

/** The search box, with a Scan button where the browser can read QR codes. */
export function Finder({ id, label, placeholder, finder, canScan }: FinderProps) {
  return (
    <div className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className="field flex-1"
        placeholder={placeholder}
        value={finder.q}
        onChange={(e) => finder.search(e.target.value)}
      />
      {canScan && detectorClass() && (
        <button type="button" className="btn btn-secondary" onClick={() => finder.setScanning(true)}>
          Scan
        </button>
      )}
    </div>
  );
}

/** "12 / 40" beside the section title: who is in, out of who is expected. */
export function Tally({ inside, of }: { inside: number; of: number }) {
  return (
    <span className="font-serif text-[24px] tabular">
      {inside} <span className="text-base text-muted">/ {of}</span>
    </span>
  );
}

interface StepperProps {
  name: string;
  n: number;
  /** A couple more than expected is fine at the door; beyond that is a mistake. */
  max: number;
  showCount?: boolean;
  onSet: (n: number) => void;
}

export function Stepper({ name, n, max, showCount, onSet }: StepperProps) {
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-label={`One less for ${name}`}
        disabled={n <= 0}
        onClick={() => onSet(n - 1)}
      >
        −
      </button>
      {showCount && <span className="w-6 text-center tabular">{n}</span>}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label={`One more in for ${name}`}
        disabled={n >= max}
        onClick={() => onSet(n + 1)}
      >
        +
      </button>
    </>
  );
}

/** Where scanning works, and what to do elsewhere. */
export function scanNote(elsewhere: string): string {
  return detectorClass() ? "" : ` Scanning works in Chrome on Android; elsewhere, ${elsewhere}.`;
}
