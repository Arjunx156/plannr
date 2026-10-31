import { useState } from "react";
import { Link } from "react-router";
import { usePageMeta } from "../components/pageMeta";
import { AppShell } from "../components/shell";
import { TaskRow } from "../components/tasks";
import { HUE_COLOR, Pill } from "../components/ui";
import type { Task } from "../data/baseTypes";
import type { Notice } from "../data/messageTypes";
import type { PlannrEvent } from "../data/types";
import { addDays, daysUntil, greeting, longDate, TODAY } from "../lib/dates";
import { watchPlan } from "../shared/watch";
import { canEdit, toast, useStore } from "../store/store";

interface Due {
  ev: PlannrEvent;
  task: Task;
}

type Flag = { ev: PlannrEvent; notice: Pick<Notice, "id" | "tone" | "label" | "text"> };

const dueKey = ({ ev, task }: Due) => `${ev.id}/${task.id}`;

/** Tasks due within a week across every event, soonest first; one ticked this visit stays in place. */
function dueThisWeek(events: PlannrEvent[], ticked: string[]): Due[] {
  const week = addDays(TODAY, 7);
  return events
    .flatMap((ev) => (ev.layout === "empty" ? [] : ev.tasks.list.map((task) => ({ ev, task }))))
    .filter((d) => (!d.task.done || ticked.includes(dueKey(d))) && d.task.due <= week)
    .sort((a, b) => a.task.due.localeCompare(b.task.due));
}

/** /today: what needs doing across every event, in the order it's due. */
export function Today() {
  usePageMeta("Today", { private: true });
  const { state, dispatch } = useStore();
  // Ticked here, kept in place for the visit so the tick shows and can be undone.
  const [ticked, setTicked] = useState<string[]>([]);
  const live = state.events.filter((e) => !e.archived);
  const due = dueThisWeek(live, ticked);
  // The two most urgent things in each event, worked out from its plan.
  const flags: Flag[] = live.flatMap((ev) =>
    watchPlan(ev, TODAY)
      .slice(0, 2)
      .map((notice) => ({ ev, notice })),
  );
  const upcoming = live.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));

  const toggle = (d: Due) => {
    const { ev, task: t } = d;
    setTicked((prev) => [...prev, dueKey(d)]);
    dispatch({ type: "toggleTask", eventId: ev.id, taskId: t.id });
    if (!t.done) dispatch(toast(`Done: ${t.title}`, { type: "toggleTask", eventId: ev.id, taskId: t.id }));
  };
  const group = {
    onToggle: toggle,
    editable: (ev: PlannrEvent) => state.mode !== "account" || canEdit(state.remote[ev.id]?.role),
  };

  return (
    <AppShell>
      <main
        id="main"
        className="mx-auto grid max-w-[1180px] gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-muted">
              {greeting()}, {state.session.firstName} · {longDate(TODAY)}
            </span>
            <h1 className="font-serif text-[44px] leading-none">Today</h1>
          </div>
          <DueGroup
            label="Overdue"
            list={due.filter((d) => d.task.due < TODAY)}
            tone="text-rust-ink"
            {...group}
          />
          <DueGroup label="Due today" list={due.filter((d) => d.task.due === TODAY)} {...group} />
          <DueGroup label="Next 7 days" list={due.filter((d) => d.task.due > TODAY)} {...group} />
          {due.length === 0 && <NothingDue hasEvents={live.length > 0} />}
        </div>
        <aside className="flex flex-col gap-5">
          {upcoming.length > 0 && <ComingUp events={upcoming} />}
          {flags.length > 0 && <NeedsDecision flags={flags} />}
        </aside>
      </main>
    </AppShell>
  );
}

interface GroupProps {
  label: string;
  list: Due[];
  tone?: string;
  editable: (ev: PlannrEvent) => boolean;
  onToggle: (d: Due) => void;
}

function DueGroup({ label, list, tone = "text-muted", editable, onToggle }: GroupProps) {
  if (list.length === 0) return null;
  return (
    <section
      aria-label={label}
      className="flex flex-col rounded-2xl border border-line bg-surface px-5 pt-3 pb-1"
    >
      <h2 className={`eyebrow pb-1 ${tone}`}>
        {label} · {list.length}
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((d) => (
          <TaskRow
            key={dueKey(d)}
            ev={d.ev}
            task={d.task}
            editable={editable(d.ev)}
            onToggle={() => onToggle(d)}
            showEvent
          />
        ))}
      </ul>
    </section>
  );
}

function NothingDue({ hasEvents }: { hasEvents: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-2 p-8">
      <span className="font-serif text-[26px]">Nothing due this week</span>
      <span className="text-body">
        {hasEvents
          ? "Enjoy the quiet, or look further ahead in an event's tasks."
          : "Plan an event and its tasks will show up here."}
      </span>
      {!hasEvents && (
        <Link to="/new?fresh=1" className="btn btn-primary">
          Plan an event
        </Link>
      )}
    </div>
  );
}

/** Each event still ahead, with the days left until it. */
function ComingUp({ events }: { events: PlannrEvent[] }) {
  return (
    <section aria-label="Coming up" className="flex flex-col gap-2">
      <h2 className="eyebrow text-muted">Coming up</h2>
      {events.map((ev) => {
        const days = daysUntil(ev.date);
        return (
          <Link
            key={ev.id}
            to={`/events/${ev.id}`}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-ink no-underline hover:border-line-2"
          >
            <span
              aria-hidden="true"
              className="h-10 w-1.5 rounded-full"
              style={{ background: HUE_COLOR[ev.hue] }}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{ev.name}</span>
              <span className="text-xs text-muted">{longDate(ev.date)}</span>
            </span>
            <span className="text-right">
              <span className="block font-serif text-2xl leading-none tabular">{days || "Today"}</span>
              {days > 0 && <span className="text-xs text-muted">days</span>}
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function NeedsDecision({ flags }: { flags: Flag[] }) {
  return (
    <section aria-label="Needs a decision" className="flex flex-col gap-2">
      <h2 className="eyebrow text-muted">Needs a decision</h2>
      {flags.map(({ ev, notice }) => (
        <Link
          key={`${ev.id}/${notice.id}`}
          to={`/events/${ev.id}`}
          className={`flex flex-col gap-1.5 rounded-xl border p-3 text-ink no-underline ${notice.tone === "ai" ? "card-ai" : "border-line bg-surface hover:border-line-2"}`}
        >
          <span className="flex items-center justify-between gap-2">
            <Pill tone={notice.tone === "info" ? "idle" : notice.tone}>{notice.label}</Pill>
            <span className="truncate text-xs text-muted">{ev.name}</span>
          </span>
          <span className="text-sm leading-[1.4]">{notice.text}</span>
        </Link>
      ))}
    </section>
  );
}
