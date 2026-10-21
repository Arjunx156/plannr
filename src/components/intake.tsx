import type { Profile } from "../data/types";
import { PRIORITY_OPTIONS } from "../lib/intake";

/** Plannr can draft once it knows the type, place, date, headcount and budget. */
export function canDraft(p: Profile): boolean {
  return !!(p.kind && p.city && p.date && p.guests && p.budget);
}

export function PriorityPicker({
  profile,
  onToggle,
}: {
  profile: Profile;
  onToggle: (option: string, list: "priorities" | "cuts") => void;
}) {
  const options = PRIORITY_OPTIONS[profile.kind ?? "other"];
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs font-medium tracking-[0.06em] text-muted uppercase">
        Most important · {profile.priorities.length} of 3
      </span>
      <div className="flex flex-wrap gap-2">
        {options.most.map((o) => {
          const rank = profile.priorities.indexOf(o);
          const full = profile.priorities.length >= 3 && rank < 0;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={rank >= 0}
              disabled={full}
              onClick={() => onToggle(o, "priorities")}
              className="chip disabled:opacity-50"
            >
              {rank >= 0 ? `${rank + 1} · ${o}` : o}
            </button>
          );
        })}
      </div>
      <span className="mt-1.5 font-mono text-xs font-medium tracking-[0.06em] text-muted uppercase">
        Okay to cut
      </span>
      <div className="flex flex-wrap gap-2">
        {options.cut.map((o) => {
          const on = profile.cuts.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o, "cuts")}
              className={`inline-flex min-h-9 items-center rounded-full border px-[13px] text-sm font-medium ${on ? "border-gold bg-cream text-amber-ink" : "border-line bg-white hover:border-line-2"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
