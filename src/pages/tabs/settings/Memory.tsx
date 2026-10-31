import { type FormEvent, useState } from "react";
import type { PlannrEvent } from "../../../data/types";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";

/** Things the family wants every suggestion to respect. The assistant reads these first. */
export function Memory({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const notes = list(ev, "memory");
  const [text, setText] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "memory",
      record: { id: newId("m"), text: text.trim() },
    });
    setText("");
  };
  return (
    <Section title="What Plannr remembers">
      <p className="m-0 text-sm text-body">
        Every suggestion respects these: dietary rules, accessibility, what's not up for change.
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {notes.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-3 border-t border-sand-2 py-2 text-sm first:border-0"
          >
            <span>◆ {m.text}</span>
            {editable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Forget “${m.text}”`}
                onClick={() => dispatch({ type: "removeRecord", eventId: ev.id, coll: "memory", id: m.id })}
              >
                Forget
              </button>
            )}
          </li>
        ))}
        {notes.length === 0 && (
          <li className="text-sm text-muted">
            Nothing yet. Try “No alcohol” or “Ammachi uses a wheelchair”.
          </li>
        )}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="mem-text" className="sr-only">
            Something to remember
          </label>
          <input
            id="mem-text"
            className="field flex-1"
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Keep the mandapam décor as quoted"
          />
          <button type="submit" className="btn btn-secondary" disabled={!text.trim()}>
            Remember
          </button>
        </form>
      )}
    </Section>
  );
}
