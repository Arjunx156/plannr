import { Field } from "../../../components/fields";
import type { FunctionDay } from "../../../data/baseTypes";
import type { Household, Meal } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { list } from "../../../shared/records";

/** How each meal preference reads. */
export const MEAL_LABEL: Record<Meal, string> = { veg: "Vegetarian", nonveg: "Non-veg", jain: "Jain" };

export type Answers = Household["rsvp"];

interface AnswersProps {
  fns: FunctionDay[];
  functions: string[];
  answers: Answers;
  /** The household's headcount, the starting count when they say yes. */
  invited: number;
  onChange: (answers: Answers) => void;
}

export function AnswersField({ fns, functions, answers, invited, onChange }: AnswersProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="label mb-1">Their answer</legend>
      <span className="text-xs text-muted">Record it here if they told you in person or on the phone.</span>
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
                const status = e.target.value as Answers[string]["status"];
                answer({ status, count: status === "yes" ? a.count || invited : 0 });
              }}
            >
              <option value="pending">Waiting</option>
              <option value="yes">Coming</option>
              <option value="no">Can't come</option>
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

export function MealField({ value, onChange }: { value?: Meal; onChange: (meal?: Meal) => void }) {
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

export function StayFields({ ev, stay, room, onStay, onRoom }: StayProps) {
  const rooms = list(ev, "rooms");
  return (
    <>
      <label className="flex items-center gap-2.5 text-sm font-medium">
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
