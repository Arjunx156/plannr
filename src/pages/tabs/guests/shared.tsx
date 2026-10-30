import type { FunctionDay, Household, PlannrEvent } from "../../../data/types";

/** The WhatsApp invitation for one household, with their RSVP link. */
export function inviteMessage(ev: PlannrEvent, h: Household): string {
  return `Namaste ${h.name}! You're invited to ${ev.name}. Please tell us who's coming:`;
}

export function reminderMessage(ev: PlannrEvent, h: Household): string {
  return `Namaste ${h.name}, a gentle reminder from the ${ev.name} family. We'd love to know who's coming:`;
}

export function FunctionPicker({
  fns,
  value,
  onChange,
  name,
}: {
  fns: FunctionDay[];
  value: string[];
  onChange: (v: string[]) => void;
  name: string;
}) {
  if (fns.length <= 1) return null;
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="label mb-1">Invited to</legend>
      <div className="flex flex-wrap gap-1.5">
        {fns.map((f) => (
          <label
            key={f.id}
            className="chip chip-sm cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-paper"
          >
            <input
              type="checkbox"
              name={name}
              className="sr-only"
              checked={value.includes(f.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, f.id] : value.filter((x) => x !== f.id))
              }
            />
            {f.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const phoneDigits = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (!d) return undefined;
  return d.length === 10 ? `91${d}` : d;
};
