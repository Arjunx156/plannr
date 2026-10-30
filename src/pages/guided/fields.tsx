import type { ReactNode } from "react";
import type { Profile } from "../../data/types";

/** The guided form's shared pieces: labelled blocks, chip pickers and the props every step takes. */

export function Chips({
  options,
  selected,
  onToggle,
  single,
}: {
  options: string[];
  selected: string[];
  onToggle: (o: string) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={selected.includes(o)}
          onClick={() => onToggle(o)}
          className={`chip min-h-10 px-3.5 ${single && selected.includes(o) ? "border-ink bg-ink text-paper" : ""}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function Block({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm leading-none font-semibold">
          {label}
        </label>
      ) : (
        <span className="text-sm leading-none font-semibold">{label}</span>
      )}
      {children}
    </div>
  );
}

export function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Adds to a list once. */
export const addOnce = (list: string[], v: string) => [...new Set([...list, v])];

export type ImagePreview = { name: string; url: string };

export interface StepProps {
  p: Profile;
  set: (patch: Partial<Profile>) => void;
  /** Inspiration images chosen on this device, kept while the planner moves between steps. */
  previews: ImagePreview[];
  addPreviews: (added: ImagePreview[]) => void;
}

/** Quick picks for a number, each pressed when it's the current value. */
export function QuickPicks({
  values,
  current,
  label = String,
  onPick,
}: {
  values: number[];
  current: number | undefined;
  label?: (n: number) => string;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((n) => (
        <button
          key={n}
          type="button"
          className="chip chip-sm"
          aria-pressed={current === n}
          onClick={() => onPick(n)}
        >
          {label(n)}
        </button>
      ))}
    </div>
  );
}
