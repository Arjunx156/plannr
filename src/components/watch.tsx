import { useState } from "react";
import { useNavigate } from "react-router";
import type { CommunityEvent, PersonalEvent } from "../data/types";
import { addDays, TODAY } from "../lib/dates";
import { useRain } from "../lib/weather";
import { headcountRipple, type Ripple } from "../shared/ripple";
import { rainWatch, watchPlan } from "../shared/watch";
import type { Watch, WatchAction } from "../shared/watchRule";
import { toast, useStore } from "../store/store";
import { RippleDialog } from "./ripple";
import { useEditable } from "./taskHooks";

import { NOTICE_CARD, Pill } from "./ui";

const KEY = "plannr:watch-hidden";

/** "Not now" hides a notice on this device for three days, or until the situation changes. */
function hidden(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function hide(id: string): void {
  try {
    const all = Object.fromEntries(Object.entries(hidden()).filter(([, until]) => until >= TODAY));
    all[id] = addDays(TODAY, 3);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Can't remember it; the notice simply stays.
  }
}

export function useWatches(ev: PersonalEvent | CommunityEvent): Watch[] {
  const rain = useRain(ev);
  const off = hidden();
  return [...rainWatch(ev, rain), ...watchPlan(ev, TODAY)]
    .filter((w) => !(off[`${ev.id}/${w.id}`] && (off[`${ev.id}/${w.id}`] ?? "") >= TODAY))
    .sort((a, b) => a.rank - b.rank);
}

/** The overview's "needs attention": live from the plan, every button doing something real. */
export function WatchList({ ev }: { ev: PersonalEvent | CommunityEvent }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const editable = useEditable(ev);
  const watches = useWatches(ev);
  const [all, setAll] = useState(false);
  const [, rerender] = useState(0);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  if (watches.length === 0) return null;
  const shown = all ? watches : watches.slice(0, 4);

  const run = (a: WatchAction) => {
    if (a.kind === "go") void navigate(a.to);
    else if (a.kind === "headcount" && ev.layout === "personal") setRipple(headcountRipple(ev, a.guests));
    else if (a.kind === "apply") {
      for (const x of a.actions) dispatch(x as Parameters<typeof dispatch>[0]);
      dispatch(toast(`${a.done} Undo it from History.`));
    }
  };

  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((w) => {
          const canRun = (a?: WatchAction) => a && (a.kind === "go" || editable);
          return (
            <article
              key={w.id}
              className={`flex flex-col gap-2 rounded-2xl border p-4 ${NOTICE_CARD[w.tone]}`}
            >
              <Pill tone={w.tone === "info" ? "idle" : w.tone}>{w.label}</Pill>
              <span className="text-[15px] leading-[1.4] font-medium">{w.text}</span>
              {w.why && <span className="text-xs leading-[1.4] text-peacock">{w.why}</span>}
              <div className="mt-1 flex flex-wrap gap-2">
                {w.primary && canRun(w.primary) && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => w.primary && run(w.primary)}
                  >
                    {w.primary.label}
                  </button>
                )}
                {w.secondary && canRun(w.secondary) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => w.secondary && run(w.secondary)}
                  >
                    {w.secondary.label}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    hide(`${ev.id}/${w.id}`);
                    rerender((n) => n + 1);
                  }}
                >
                  Not now
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {watches.length > 4 && (
        <button type="button" className="link self-start text-sm" onClick={() => setAll((s) => !s)}>
          {all ? "Show fewer" : `Show ${watches.length - 4} more`}
        </button>
      )}
      <RippleDialog ripple={ripple} onClose={() => setRipple(null)} />
    </section>
  );
}
