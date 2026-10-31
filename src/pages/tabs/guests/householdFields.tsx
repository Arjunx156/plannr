import type { JSX } from "react";
import { Field } from "../../../components/fields";
import type { FunctionDay } from "../../../data/baseTypes";
import type { Household, Meal, RsvpStatus } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { keysOf, oneOf } from "../../../shared/guards";
import { list } from "../../../shared/records";

/** How a planner records a household's answer for one function. */
const ANSWER_LABEL: Record<RsvpStatus, string> = { pending: "Waiting", yes: "Coming", no: "Can't come" };

/** How each meal preference reads. */
export const MEAL_LABEL: Record<Meal, string> = { veg: "Vegetarian", nonveg: "Non-veg", jain: "Jain" };

/** A household's answer for each function it's invited to. */
export type Answers = Household["rsvp"];

interface AnswersProps {
  fns: FunctionDay[];
  functions: string[];
  answers: Answers;
  /** The household's headcount, the starting count when they say yes. */
  invited: number;
  onChange: (answers: Answers) => void;
}

/** The answer and head count for each function, as the planner records them. */
export function AnswersField({ fns, functions, answers, invited, onChange }: AnswersProps): JSX.Element {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="label mb-1">Their answer</legend>
      <span className="text-muted text-xs">Record it here if they told you in person or on the phone.</span>
      {functions.map((fid) => {
        const label = fns.find((x) => x.id === fid)?.label ?? fid;
        const a = answers[fid] ?? { status: "pending" as const, count: 0 };
        const answer = (next: Answers[string]) => onChange({ ...answers, [fid]: next });
        return (
          <div key={fid} className="grid grid-cols-[1fr_auto_72px] items-center gap-2 text-sm">
            <span>{label}</span>
            <select
              aria-label={`Answer for ${label}`}
              className="field h-9 min-h-0 appearance-auto py-0 text-sm"
              value={a.status}
              onChange={(e) => {
                const status = oneOf(e.target.value, keysOf(ANSWER_LABEL));
                if (status) answer({ status, count: status === "yes" ? a.count || invited : 0 });
              }}
            >
              {keysOf(ANSWER_LABEL).map((k) => (
                <option key={k} value={k}>
                  {ANSWER_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              aria-label={`People coming to ${label}`}
              className="field h-9 min-h-0 py-0 text-sm"
              inputMode="numeric"
              disabled={a.status !== "yes"}
              value={a.status === "yes" ? String(a.count) : ""}
              onChange={(e) =>
                answer({ status: "yes", count: Number(e.target.value.replace(/\D/g, "")) || 1 })
              }
            />
          </div>
        );
      })}
    </fieldset>
  );
}

/** A household's meal choice. */
export function MealField({
  value,
  onChange,
}: {
  value?: Meal | undefined;
  onChange: (meal?: Meal) => void;
}): JSX.Element {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="label mb-1">Meal</legend>
      <div className="flex flex-wrap gap-1.5">
        {(["veg", "nonveg", "jain"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={value === m}
            className="chip chip-sm"
            onClick={() => onChange(value === m ? undefined : m)}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface StayProps {
  ev: PlannrEvent;
  stay: boolean;
  room: string;
  onStay: (stay: boolean) => void;
  onRoom: (room: string) => void;
}

/** Where a household stays, and the room it has, for out-of-town guests. */
export function StayFields({ ev, stay, room, onStay, onRoom }: StayProps): JSX.Element {
  const rooms = list(ev, "rooms");
  return (
    <>
      <label className="flex items-center gap-2.5 font-medium text-sm">
        <input
          type="checkbox"
          checked={stay}
          onChange={(e) => onStay(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-leaf)]"
        />
        Needs a room
      </label>
      {stay && rooms.length > 0 && (
        <Field label="Room block" htmlFor="hs-room">
          <select
            id="hs-room"
            className="field appearance-auto"
            value={room}
            onChange={(e) => onRoom(e.target.value)}
          >
            <option value="">Not assigned</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.hotel}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}
