import { type FormEvent, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { TextField } from "../../components/fields";
import { Modal } from "../../components/overlays";
import { LoadError, useRemote } from "../../components/remote";
import type { PlannrEvent } from "../../data/types";
import { api } from "../../lib/api";
import { addDays, longDate, TODAY } from "../../lib/dates";
import type { TemplateRow } from "../../shared/types";
import { toast, useStore } from "../../store/store";
import { Section } from "./layout";

/** Save this event to start the next one from: next year's mela begins with this year's plan. */
export function SaveTemplate({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState(`${ev.name} (template)`);
  const [busy, setBusy] = useState(false);
  if (ev.layout === "empty") return null;
  const account = state.mode === "account";
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveTemplate(ev.id, name.trim() || ev.name);
      dispatch(toast("Saved. Start your next event from it on My events."));
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };
  return (
    <Section title="Use this plan again">
      <p className="m-0 text-sm text-body">
        Saves the tasks, vendors with what they charged, the budget as it really turned out, the run sheet and{" "}
        {ev.layout === "community" ? "the committee's lists" : "the guest list"}. Answers, payments, photos
        and check-ins start fresh, and every date moves to the new day.
      </p>
      {account ? (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <TextField id="tpl-name" label="Template name" value={name} maxLength={120} onChange={setName} />
          <button type="submit" className="btn btn-secondary" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : "Save as a template"}
          </button>
        </form>
      ) : (
        <p className="m-0 text-sm">
          <Link to="/signup" className="link">
            Create an account
          </Link>{" "}
          to keep templates.
        </p>
      )}
    </Section>
  );
}

/** 52 weeks, so a yearly event keeps its weekday. */
const YEAR_DAYS = 364;
const DAY_MS = 86_400_000;

/** When a yearly event next falls: its own date if still ahead, else whole years of 52 weeks on. */
function nextDate(last: string): string {
  if (last > TODAY) return last;
  const years = Math.max(1, Math.ceil((Date.parse(TODAY) - Date.parse(last)) / (YEAR_DAYS * DAY_MS)));
  return addDays(last, YEAR_DAYS * years);
}

/** Starts a new event from a saved template. */
export function TemplatePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const load = useCallback(() => api.templates(), []);
  const templates = useRemote(open ? load : undefined, open);
  const list = templates.data;
  const [chosen, setChosen] = useState<TemplateRow | null>(null);

  const remove = async (t: TemplateRow) => {
    try {
      await api.deleteTemplate(t.id);
      templates.set((l) => (l ?? []).filter((x) => x.id !== t.id));
    } catch (err) {
      dispatch(toast(`Couldn't remove ${t.name}: ${(err as Error).message}`));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start from a template" width={520}>
      {templates.error && (
        <LoadError what="your templates" error={templates.error} onRetry={templates.reload} />
      )}
      {list === null && !templates.error && <p className="m-0 text-sm text-muted">Loading…</p>}
      {list?.length === 0 && (
        <p className="m-0 text-sm text-body">
          No templates yet. Open a past event's Settings and choose “Save as a template”: next year's plan
          starts there.
        </p>
      )}
      {!!list?.length && chosen && (
        <StartForm template={chosen} onBack={() => setChosen(null)} onStarted={onClose} />
      )}
      {!!list?.length && !chosen && <TemplateList list={list} onPick={setChosen} onRemove={remove} />}
    </Modal>
  );
}

interface ListProps {
  list: TemplateRow[];
  onPick: (t: TemplateRow) => void;
  onRemove: (t: TemplateRow) => void;
}

function TemplateList({ list, onPick, onRemove }: ListProps) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {list.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between gap-2 border-t border-sand-2 py-2.5 first:border-0"
        >
          <span className="flex flex-col text-sm">
            <span className="font-semibold">{t.name}</span>
            <span className="text-xs text-muted">Last held {longDate(t.date)}</span>
          </span>
          <span className="flex gap-1.5">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onPick(t)}>
              Use
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label={`Delete ${t.name}`}
              onClick={() => onRemove(t)}
            >
              Delete
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

interface StartProps {
  template: TemplateRow;
  onBack: () => void;
  onStarted: () => void;
}

/** A name and a date for the new event, then the event itself, with last time's plan and costs. */
function StartForm({ template, onBack, onStarted }: StartProps) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState(() => template.name.replace(/\s*\(template\)$/i, ""));
  const [date, setDate] = useState(() => nextDate(template.date));
  const [busy, setBusy] = useState(false);
  const start = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const plan = await api.startFromTemplate(template.id, name.trim() || template.name, date);
      dispatch({ type: "syncPlan", plan });
      dispatch(toast(`${plan.event.name} is ready, with last time's plan and costs.`));
      onStarted();
      void navigate(`/events/${plan.event.id}`);
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };
  return (
    <form onSubmit={start} className="flex flex-col gap-3">
      <p className="m-0 text-sm text-body">
        From <strong>{template.name}</strong>, last held on {longDate(template.date)}. Every date moves to the
        new day.
      </p>
      <TextField id="tpl-new-name" label="Name" value={name} onChange={setName} />
      <TextField id="tpl-new-date" label="Date" type="date" value={date} onChange={setDate} />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !date}>
          {busy ? "Creating…" : "Create the event"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </form>
  );
}
