import type { GuestText } from "../../lib/guestText";
import type { PublicBasics } from "../../shared/public";
import { FunctionFacts } from "./shell";

/** One household's answer for one function. */
export type Answer = { status: "pending" | "yes" | "no"; count: number };
/** A household may bring up to two more people than were invited. */
export const EXTRA_GUESTS = 2;
export const isAnswered = (a: Answer | undefined): a is Answer => !!a && a.status !== "pending";
/** One function on the RSVP form: when and where, then going (and how many) or can't come. */
export function FunctionAnswer({
  fn: f,
  answer: a,
  invited,
  t,
  onChange,
}: {
  fn: PublicBasics["functions"][number];
  answer: Answer;
  /** How many of this household were invited. */
  invited: number;
  t: GuestText;
  onChange: (next: Answer) => void;
}) {
  const set = (patch: Partial<Answer>) => onChange({ ...a, ...patch });
  const most = invited + EXTRA_GUESTS;
  return (
    <fieldset className="m-0 flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4">
      <legend className="sr-only">{f.label}</legend>
      <div className="flex flex-col gap-0.5">
        <span className="font-serif text-[22px] leading-tight">{f.label}</span>
        <FunctionFacts f={f} t={t} />
      </div>
      <div className="grid grid-cols-[1fr_1fr_88px] gap-2">
        <button
          type="button"
          aria-pressed={a.status === "yes"}
          onClick={() => set({ status: "yes", count: a.count || invited })}
          className={`min-h-11 rounded-lg border text-sm font-semibold ${a.status === "yes" ? "border-leaf bg-leaf-tint text-leaf-ink" : "border-line-2"}`}
        >
          {a.status === "yes" ? "✓ " : ""}
          {t.going}
        </button>
        <button
          type="button"
          aria-pressed={a.status === "no"}
          onClick={() => set({ status: "no" })}
          className={`min-h-11 rounded-lg border text-sm font-semibold ${a.status === "no" ? "border-line-2 bg-sand" : "border-line-2"}`}
        >
          {t.cant}
        </button>
        <label className="sr-only" htmlFor={`count-${f.id}`}>
          {t.howMany} {f.label}
        </label>
        <select
          id={`count-${f.id}`}
          className="field min-h-11 appearance-auto py-0"
          disabled={a.status !== "yes"}
          value={a.count}
          onChange={(e) => set({ count: Number(e.target.value) })}
        >
          {Array.from({ length: most }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
