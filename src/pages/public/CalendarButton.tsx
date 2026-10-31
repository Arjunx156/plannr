import { downloadIcs } from "../../lib/ics";
import type { PublicBasics } from "../../shared/public";

/** Adds every function to the guest's calendar as one .ics file. */
export function CalendarButton({ view, label }: { view: { event: PublicBasics }; label: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() =>
        downloadIcs(
          view.event.name,
          view.event.functions.map((f) => ({
            id: `${view.event.name}-${f.id}`,
            title: `${f.label} · ${view.event.name}`,
            date: f.date,
            time: f.time,
            place: f.address ?? f.place,
          })),
        )
      }
    >
      {label}
    </button>
  );
}
