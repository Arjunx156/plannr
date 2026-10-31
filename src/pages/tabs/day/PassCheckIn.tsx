import { Scanner } from "../../../components/scanner";
import type { Pass } from "../../../data/communityTypes";
import type { PlannrEvent } from "../../../data/types";
import { readPassCode } from "../../../shared/public";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { Section } from "../layout";
import { DOOR_ROWS, Finder, Stepper, scanNote, Tally, useFinder } from "./door";

/** Community passes at the gate: scan the printed QR, or find the flat or name. */
export function PassCheckIn({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const finder = useFinder();
  const passes = list(ev, "passes");
  if (passes.length === 0) return null;
  const inside = passes.reduce((s, p) => s + (p.checkedIn ?? 0), 0);
  const issued = passes.reduce((s, p) => s + p.count, 0);
  const { term, found } = finder;
  const shown = (
    found
      ? passes.filter((p) => p.id === found)
      : passes.filter((p) => !term || p.name.toLowerCase().includes(term))
  ).slice(0, DOOR_ROWS);
  const set = (id: string, count: number) =>
    dispatch({ type: "checkIn", eventId: ev.id, coll: "passes", id, fnId: "day", count });
  const scanned = (text: string) => {
    finder.setScanning(false);
    const pass = passes.find((p) => p.id === readPassCode(text));
    if (!pass) {
      dispatch(toast("That code isn't a pass for this event."));
      return;
    }
    finder.pick(pass.id);
    if (!pass.checkedIn) set(pass.id, pass.count);
    dispatch(toast(`Welcome, ${pass.name}: ${pass.checkedIn || pass.count} in.`));
  };
  return (
    <Section title="Gate" aside={<Tally inside={inside} of={issued} />}>
      <Finder
        id="gate-pass-q"
        label="Find a pass"
        placeholder="Flat number or name"
        finder={finder}
        canScan={editable}
      />
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((p) => (
          <PassRow key={p.id} p={p} editable={editable} onSet={(n) => set(p.id, n)} />
        ))}
      </ul>
      <span className="text-xs text-muted">
        Print the passes from Stalls & passes; each has a QR code.
        {scanNote("search by flat or name")}
      </span>
      {finder.scanning && (
        <Scanner title="Scan a pass" onCode={scanned} onClose={() => finder.setScanning(false)} />
      )}
    </Section>
  );
}

function PassRow({ p, editable, onSet }: { p: Pass; editable: boolean; onSet: (n: number) => void }) {
  const n = p.checkedIn ?? 0;
  return (
    <li className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0">
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{p.name}</span>
        <span className="text-xs text-muted">
          {n} of {p.count} in
        </span>
      </span>
      {editable && (
        <span className="flex items-center gap-1.5">
          <Stepper name={p.name} n={n} max={p.count + 2} onSet={onSet} />
        </span>
      )}
    </li>
  );
}
