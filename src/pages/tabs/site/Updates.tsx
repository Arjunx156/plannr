import { type FormEvent, useState } from "react";
import type { PlannrEvent } from "../../../data/types";
import { timeAgo } from "../../../lib/format";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

/** Notes for guests that show at the top of the website and every RSVP page. */
export function Updates({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const items = list(ev, "announcements").slice().reverse();
  const [text, setText] = useState("");
  const post = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "announcements",
      record: { id: newId("an"), at: "", text: clean },
    });
    dispatch(toast("Posted. Guests see it at the top of their pages."));
    setText("");
  };
  return (
    <Section title="Updates for guests">
      {editable && (
        <form onSubmit={post} className="flex flex-col gap-2">
          <label htmlFor="update-text" className="sr-only">
            Update
          </label>
          <textarea
            id="update-text"
            className="field min-h-16 py-2"
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buses to the reception leave at 6:15 pm from the main gate."
          />
          <button type="submit" className="btn btn-secondary btn-sm self-start" disabled={!text.trim()}>
            Post update
          </button>
        </form>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((a) => (
          <li
            key={a.id}
            className="flex items-start justify-between gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex flex-col">
              <span>{a.text}</span>
              <span className="text-xs text-muted">{a.at ? timeAgo(a.at) : ""}</span>
            </span>
            {editable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  dispatch({ type: "removeRecord", eventId: ev.id, coll: "announcements", id: a.id })
                }
              >
                Remove
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">No updates yet.</li>}
      </ul>
    </Section>
  );
}
