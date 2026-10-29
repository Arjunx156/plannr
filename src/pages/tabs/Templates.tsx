import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Field, Modal } from "../../components/ui";
import type { PlannrEvent } from "../../data/types";
import { api } from "../../lib/api";
import { addDays, longDate, TODAY } from "../../lib/dates";
import type { TemplateRow } from "../../shared/types";
import { toast, useStore } from "../../store/store";
import { Section } from "./common";

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
          <Field label="Template name" htmlFor="tpl-name">
            <input
              id="tpl-name"
              className="field"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
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

/** Starts a new event from a saved template. */
export function TemplatePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [list, setList] = useState<TemplateRow[] | null>(null);
  const [chosen, setChosen] = useState<TemplateRow | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(addDays(TODAY, 365));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    api
      .templates()
      .then((t) => live && setList(t))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [open]);

  const pick = (t: TemplateRow) => {
    setChosen(t);
    setName(t.name.replace(/\s*\(template\)$/i, ""));
    // Same day next year is the usual start for a yearly event.
    setDate(
      t.date > TODAY
        ? t.date
        : addDays(
            t.date,
            364 * Math.max(1, Math.ceil((Date.parse(TODAY) - Date.parse(t.date)) / (364 * 86400000))),
          ),
    );
  };

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    try {
      const plan = await api.startFromTemplate(chosen.id, name.trim() || chosen.name, date);
      dispatch({ type: "syncPlan", plan });
      dispatch(toast(`${plan.event.name} is ready, with last time's plan and costs.`));
      onClose();
      navigate(`/events/${plan.event.id}`);
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };

  const remove = async (t: TemplateRow) => {
    await api.deleteTemplate(t.id).catch(() => {});
    setList((l) => (l ?? []).filter((x) => x.id !== t.id));
  };

  return (
    <Modal open={open} onClose={onClose} title="Start from a template" width={520}>
      {list === null ? (
        <p className="m-0 text-sm text-muted">Loading…</p>
      ) : !list.length ? (
        <p className="m-0 text-sm text-body">
          No templates yet. Open a past event's Settings and choose “Save as a template”: next year's plan
          starts there.
        </p>
      ) : chosen ? (
        <form onSubmit={start} className="flex flex-col gap-3">
          <p className="m-0 text-sm text-body">
            From <strong>{chosen.name}</strong>, last held on {longDate(chosen.date)}. Every date moves to the
            new day.
          </p>
          <Field label="Name" htmlFor="tpl-new-name">
            <input
              id="tpl-new-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Date" htmlFor="tpl-new-date">
            <input
              id="tpl-new-date"
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !date}>
              {busy ? "Creating…" : "Create the event"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setChosen(null)}>
              Back
            </button>
          </div>
        </form>
      ) : (
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
                <button type="button" className="btn btn-primary btn-sm" onClick={() => pick(t)}>
                  Use
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => remove(t)}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
