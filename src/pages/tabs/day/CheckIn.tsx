import { Scanner } from "../../../components/scanner";
import type { FunctionDay } from "../../../data/baseTypes";
import type { Household, RsvpStatus } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { checkInCount, comingCount } from "../../../shared/derive";
import { readEntryCode } from "../../../shared/public";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { Section } from "../layout";
import { DOOR_ROWS, Finder, Stepper, scanNote, Tally, useFinder } from "./door";

/** What a household said for this function. */
function answerText(a: { status: RsvpStatus; count: number } | undefined): string {
  if (a?.status === "yes") return `${a.count} coming`;
  return a?.status === "no" ? "said they can't come" : "didn't answer";
}

/** How many a household brings: their answer once they've said yes, else everyone invited. */
function bringing(h: Household, fnId: string): number {
  const a = h.rsvp[fnId];
  return (a?.status === "yes" ? a.count : comingCount(h)) || h.expected;
}

interface Props {
  ev: PlannrEvent;
  fn: FunctionDay;
  editable: boolean;
}

/** Guest check-in at the door, by name or by scanning an entry QR code. */
export function CheckIn({ ev, fn, editable }: Props) {
  const { dispatch } = useStore();
  const finder = useFinder();
  const invited = list(ev, "households").filter((h) => h.functions.includes(fn.id));
  if (invited.length === 0) return null;
  const { inside, expected } = checkInCount(ev, fn.id);
  const { term, found } = finder;
  const matches = found
    ? invited.filter((h) => h.id === found)
    : invited.filter((h) => !term || h.name.toLowerCase().includes(term) || h.phone?.endsWith(term));
  // Families who said how many are coming come first.
  const shown = matches
    .sort((a, b) => Number(!!b.rsvp[fn.id]?.count) - Number(!!a.rsvp[fn.id]?.count))
    .slice(0, DOOR_ROWS);
  const set = (id: string, count: number) =>
    dispatch({ type: "checkIn", eventId: ev.id, coll: "households", id, fnId: fn.id, count });
  const scanned = (text: string) => {
    const id = readEntryCode(text);
    const h = id ? invited.find((x) => x.id === id) : undefined;
    finder.setScanning(false);
    if (!h) {
      dispatch(toast("That code isn't an invitation to this function."));
      return;
    }
    finder.pick(h.id);
    const coming = bringing(h, fn.id);
    if (!h.checkedIn?.[fn.id]) set(h.id, coming);
    dispatch(toast(`Welcome, ${h.name}: ${plural(coming, "person", "people")} checked in.`));
  };
  return (
    <Section title="Check-in" aside={<Tally inside={inside} of={expected} />}>
      <Finder
        id="ci-q"
        label="Find a family"
        placeholder="Name or last digits of the phone"
        finder={finder}
        canScan={editable}
      />
      <ul className="m-0 flex list-none flex-col p-0">
        {shown.map((h) => (
          <GuestRow key={h.id} h={h} fnId={fn.id} editable={editable} onSet={(n) => set(h.id, n)} />
        ))}
      </ul>
      <span className="text-xs text-muted">
        Guests who said yes have an entry code on their invitation page.
        {scanNote("search by name")}
      </span>
      {finder.scanning && <Scanner onCode={scanned} onClose={() => finder.setScanning(false)} />}
    </Section>
  );
}

interface RowProps {
  h: Household;
  fnId: string;
  editable: boolean;
  onSet: (n: number) => void;
}

function GuestRow({ h, fnId, editable, onSet }: RowProps) {
  const a = h.rsvp[fnId];
  const n = h.checkedIn?.[fnId] ?? 0;
  return (
    <li className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm first:border-0">
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{h.name}</span>
        <span className="text-xs text-muted">
          {answerText(a)}
          {n ? ` · ${n} in` : ""}
        </span>
      </span>
      {editable && (
        <span className="flex items-center gap-1.5">
          <Stepper name={h.name} n={n} max={h.expected + 2} showCount onSet={onSet} />
          {!n && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onSet(a?.status === "yes" ? a.count : h.expected)}
            >
              All in
            </button>
          )}
        </span>
      )}
    </li>
  );
}
