import type { Household } from "../../../data/guestTypes";
import type { PlannrEvent } from "../../../data/types";
import { plural } from "../../../lib/format";
import { duplicateGroups } from "../../../shared/derive";
import { toast, useStore } from "../../../store/store";

/** Households that look like one family added twice, each group with a way to merge it. */
export function Duplicates({ ev, households }: { ev: PlannrEvent; households: Household[] }) {
  const { dispatch } = useStore();
  const dupes = duplicateGroups(households);
  if (dupes.length === 0) return null;

  // The first household stays, with the largest headcount, every function and every answer.
  const merge = (group: Household[]) => {
    const [keep, ...rest] = group;
    if (!keep) return;
    dispatch({
      type: "updateRecord",
      eventId: ev.id,
      coll: "households",
      id: keep.id,
      patch: {
        expected: Math.max(...group.map((h) => h.expected)),
        functions: [...new Set(group.flatMap((h) => h.functions))],
        phone: group.find((h) => h.phone)?.phone,
        rsvp: Object.assign({}, ...rest.map((h) => h.rsvp), keep.rsvp),
      },
    });
    for (const h of rest) dispatch({ type: "removeRecord", eventId: ev.id, coll: "households", id: h.id });
    dispatch(toast(`Merged into ${keep.name}.`));
  };

  return (
    <section
      aria-label="Possible duplicates"
      className="flex flex-col gap-2 rounded-2xl border border-amber-line bg-cream p-4 text-amber-ink"
    >
      <span className="font-semibold">
        {plural(dupes.length, "family looks", "families look")} like{" "}
        {dupes.length === 1 ? "it was" : "they were"} added twice
      </span>
      {dupes.map((g) => (
        <span
          key={g.map((h) => h.id).join()}
          className="flex flex-wrap items-center justify-between gap-2 text-sm"
        >
          <span>{g.map((h) => `${h.name} (${h.expected})`).join(" and ")}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => merge(g)}>
            Merge into one
          </button>
        </span>
      ))}
    </section>
  );
}
