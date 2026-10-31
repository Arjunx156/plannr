import { useState } from "react";
import { useEditable } from "../../components/taskHooks";
import type { PlannrEvent } from "../../data/types";
import { longDate, TODAY } from "../../lib/dates";
import { functionOn } from "../../shared/derive";
import { functionsOf } from "../../shared/eventLists";
import { CheckIn } from "./day/CheckIn";
import { Album, Arrivals, Checklist, Helpers } from "./day/daySections";
import { PassCheckIn } from "./day/PassCheckIn";
import { RunSheet } from "./day/RunSheet";
import { TabPage } from "./layout";
import { Updates } from "./site/Updates";

/** /events/:id/day — the run sheet, check-in and everything the day itself needs, on one phone. */
export function DayTab({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  const fns = functionsOf(ev)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  const [fnId, setFnId] = useState(() => functionOn(ev, TODAY)?.id ?? fns[0]?.id ?? "day");
  const fn = fns.find((f) => f.id === fnId) ?? fns[0];
  if (!fn) return null;
  const live = fn.date === TODAY;
  return (
    <TabPage
      eyebrow={ev.name}
      title="Day of"
      wide
      aside={
        fns.length > 1 && (
          <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
            <legend className="sr-only">Function</legend>
            {fns.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.id === fn.id}
                className="chip chip-sm"
                onClick={() => setFnId(f.id)}
              >
                {f.label}
                {f.date === TODAY ? " · today" : ""}
              </button>
            ))}
          </fieldset>
        )
      }
    >
      <p className="m-0 text-body">
        {fn.label} · {longDate(fn.date)}
        {fn.place ? ` · ${fn.place}` : ""}
        {!live && fn.date > TODAY ? ". The live view switches on that morning." : ""}
      </p>
      <RunSheet ev={ev} fn={fn} live={live} editable={editable} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CheckIn ev={ev} fn={fn} editable={editable} />
        <PassCheckIn ev={ev} editable={editable} />
        <Checklist ev={ev} fn={fn} editable={editable} />
      </div>
      <Arrivals ev={ev} fn={fn} />
      <Helpers ev={ev} fn={fn} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Updates ev={ev} editable={editable} />
        <Album ev={ev} />
      </div>
    </TabPage>
  );
}
