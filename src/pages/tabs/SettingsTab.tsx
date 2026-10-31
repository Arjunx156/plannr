import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Field } from "../../components/fields";
import { useEditable } from "../../components/taskHooks";
import type { PlannrEvent } from "../../data/types";
import { toast, useStore } from "../../store/store";
import { Section, TabPage } from "./layout";
import { SaveTemplate } from "./planTemplates";
import { Functions } from "./settings/Functions";
import { Memory } from "./settings/Memory";

export function SettingsTab({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  return (
    <TabPage eyebrow={ev.name} title="Settings">
      <Basics ev={ev} editable={editable} />
      <Functions ev={ev} editable={editable} />
      <Memory ev={ev} editable={editable} />
      <SaveTemplate ev={ev} />
      <Archive ev={ev} editable={editable} />
    </TabPage>
  );
}

function Basics({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const [name, setName] = useState(ev.name);
  const [date, setDate] = useState(ev.date);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== ev.name)
      dispatch({ type: "updateEvent", eventId: ev.id, patch: { name: name.trim() } });
    if (date && date !== ev.date) dispatch({ type: "updateEvent", eventId: ev.id, patch: { date } });
    dispatch(toast("Saved."));
  };
  return (
    <Section title="The event">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label="Name" htmlFor="ev-name">
          <input
            id="ev-name"
            className="field"
            value={name}
            disabled={!editable}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Main date" htmlFor="ev-date">
          <input
            id="ev-date"
            type="date"
            className="field"
            value={date}
            disabled={!editable}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        {editable && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={(!name.trim() || name === ev.name) && date === ev.date}
          >
            Save
          </button>
        )}
      </form>
    </Section>
  );
}

function Archive({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  if (!editable) return null;
  return (
    <Section title={ev.archived ? "Archived" : "When it's over"}>
      <p className="m-0 text-sm text-body">
        Archiving moves the event to Past events. Everything is kept, shared links stop working, and you can
        restore it any time.
      </p>
      <button
        type="button"
        className="btn btn-outline self-start"
        onClick={() => {
          dispatch({ type: "archiveEvent", eventId: ev.id, archived: !ev.archived });
          dispatch(toast(ev.archived ? "Restored." : "Archived."));
          if (!ev.archived) void navigate("/events");
        }}
      >
        {ev.archived ? "Restore the event" : "Archive the event"}
      </button>
    </Section>
  );
}
