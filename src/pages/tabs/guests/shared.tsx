import type { JSX } from "react";
import { Field } from "../../../components/fields";
import type { FunctionDay } from "../../../data/baseTypes";
import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";

/** The WhatsApp invitation for one household, with their RSVP link. */
export function inviteMessage(ev: PlannrEvent, h: Household): string {
  return `Namaste ${h.name}! You're invited to ${ev.name}. Please tell us who's coming:`;
}

/** A gentle WhatsApp reminder for a household that hasn't answered. */
export function reminderMessage(ev: PlannrEvent, h: Household): string {
  return `Namaste ${h.name}, a gentle reminder from the ${ev.name} family. We'd love to know who's coming:`;
}

/** Picks one function, or all of them. */
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
}): JSX.Element | null {
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

/** A phone number as digits only, with India's 91 added to a 10-digit number; undefined when there are none. */
export const phoneDigits = (raw: string): string | undefined => {
  const d = raw.replace(/\D/g, "");
  if (!d) return undefined;
  return d.length === 10 ? `91${d}` : d;
};

/**
 * How many people a household brings and which side they're from, with the sides already in
 * use offered as suggestions. Ids are prefixed with `id` so two forms can share a page.
 */
export function PeopleAndSide({
  id,
  label,
  count,
  onCount,
  side,
  onSide,
  sides,
}: {
  id: string;
  label: string;
  count: string;
  onCount: (count: string) => void;
  side: string;
  onSide: (side: string) => void;
  sides: string[];
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={label} htmlFor={`${id}-count`}>
        <input
          id={`${id}-count`}
          className="field"
          inputMode="numeric"
          value={count}
          onChange={(e) => onCount(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <Field label="Side" htmlFor={`${id}-side`}>
        <input
          id={`${id}-side`}
          className="field"
          list={`${id}-sides`}
          value={side}
          onChange={(e) => onSide(e.target.value)}
        />
        <datalist id={`${id}-sides`}>
          {sides.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}
