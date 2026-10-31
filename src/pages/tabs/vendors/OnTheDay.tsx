import type { PlannrEvent } from "../../../data/types";
import type { Vendor } from "../../../data/vendorTypes";
import { longDate } from "../../../lib/dates";
import { clock } from "../../../shared/derive";
import { functionsOf } from "../../../shared/eventLists";
import { ShareLink } from "../ShareLink";
import type { PatchVendor } from "./vendorDetails";

/** When a booked vendor arrives for each function, and the call sheet that tells them. */
export function OnTheDay({
  ev,
  v,
  editable,
  patch,
}: {
  ev: PlannrEvent;
  v: Vendor;
  editable: boolean;
  patch: PatchVendor;
}) {
  const fns = functionsOf(ev);
  const arrivals = v.arrivals ?? [];
  const setArrival = (fnId: string, time: string) =>
    patch({
      arrivals: time
        ? [...arrivals.filter((a) => a.fnId !== fnId), { fnId, time }]
        : arrivals.filter((a) => a.fnId !== fnId),
    });
  return (
    <section aria-label="On the day" className="flex flex-col gap-2">
      <h3 className="font-semibold">On the day</h3>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {fns.map((f) => {
          const a = arrivals.find((x) => x.fnId === f.id);
          return (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <label htmlFor={`arr-${f.id}`}>
                {f.label} <span className="text-muted">· {longDate(f.date)}</span>
              </label>
              {editable ? (
                <input
                  id={`arr-${f.id}`}
                  type="time"
                  className="field h-8 w-32"
                  value={a?.time ?? ""}
                  onChange={(e) => setArrival(f.id, e.target.value)}
                />
              ) : (
                <span>{a ? clock(a.time) : "—"}</span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="text-xs text-muted">
        Their call sheet shows when to arrive, the run sheet, what they need and what's been paid. Nothing
        else.
      </span>
      <ShareLink
        ev={ev}
        kind="vendor"
        target={v.id}
        phone={v.phone}
        label="Send call sheet"
        message={`Namaste${v.contact ? ` ${v.contact}` : ""}, here's the call sheet for ${ev.name}: timings, the plan for the day and payments.`}
      />
    </section>
  );
}
