import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { PlannrEvent } from "../data/types";
import { tabsFor } from "../lib/eventTabs";
import { useStore } from "../store/store";
import { Modal } from "./overlays";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

/** An event's tasks; a blank event has none. */
function taskList(ev: PlannrEvent) {
  return ev.layout === "empty" ? [] : ev.tasks.list;
}

type Go = (to: string) => () => void;

/** Most results the palette lists at once. */
const MAX_COMMANDS = 40;

/** The open event's tabs. */
function tabCommands(current: PlannrEvent | undefined, go: Go): Command[] {
  if (!current) return [];
  return tabsFor(current).map((t) => ({
    id: `tab-${t.id}`,
    label: t.label,
    hint: current.name,
    group: "This event",
    run: go(`/events/${current.id}${t.id ? `/${t.id}` : ""}`),
  }));
}

/** Every event that isn't archived. */
function eventCommands(events: PlannrEvent[], go: Go): Command[] {
  return events
    .filter((e) => !e.archived)
    .map((ev) => ({
      id: `ev-${ev.id}`,
      label: ev.name,
      hint: ev.listMeta,
      group: "Events",
      run: go(`/events/${ev.id}`),
    }));
}

/** The app's own pages. */
function pageCommands(demo: boolean, go: Go): Command[] {
  return [
    { id: "new", label: "Plan a new event", group: "Go to", run: go("/new?fresh=1") },
    { id: "today", label: "Today", hint: "What's due across every event", group: "Go to", run: go("/today") },
    { id: "inbox", label: "Inbox", hint: "What co-planners changed", group: "Go to", run: go("/inbox") },
    { id: "events", label: "My events", group: "Go to", run: go("/events") },
    ...(demo ? [{ id: "signup", label: "Create an account", group: "Go to", run: go("/signup") }] : []),
  ];
}

/** Tasks in any event whose title contains the query. */
function taskCommands(events: PlannrEvent[], q: string, go: Go): Command[] {
  return events.flatMap((ev) =>
    taskList(ev)
      .filter((t) => t.title.toLowerCase().includes(q))
      .map((t) => ({
        id: `task-${ev.id}-${t.id}`,
        label: t.title,
        hint: `${ev.name}${t.done ? " · done" : ""}`,
        group: "Tasks",
        run: go(`/events/${ev.id}/timeline?task=${encodeURIComponent(t.id)}`),
      })),
  );
}

/** Commands matching the query: the open event's tabs, events, pages, then (from two letters) tasks. */
function buildCommands(
  events: PlannrEvent[],
  opts: { query: string; currentId: string | undefined; demo: boolean },
  go: Go,
): Command[] {
  const q = opts.query.trim().toLowerCase();
  const all = [
    ...tabCommands(
      events.find((e) => e.id === opts.currentId),
      go,
    ),
    ...eventCommands(events, go),
    ...pageCommands(opts.demo, go),
  ];
  const shown = all.filter((c) => !q || `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q));
  if (q.length < 2) return shown;
  return [...shown, ...taskCommands(events, q, go).slice(0, Math.max(0, MAX_COMMANDS - shown.length))];
}

const ignoreKey = () => undefined;

/** The highlighted result, moved by the arrow keys from the search box; Enter runs it. */
function useActive(commands: Command[]) {
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, commands.length - 1));
  const step = (by: number) => setActive((index + by + commands.length) % Math.max(1, commands.length));
  const keys: Record<string, () => void> = {
    ArrowDown: () => step(1),
    ArrowUp: () => step(-1),
    Enter: () => commands[index]?.run(),
  };
  const onKey = (e: KeyboardEvent) => {
    const act = keys[e.key];
    if (!act) return;
    e.preventDefault();
    act();
  };
  return { index, setActive, onKey };
}

/** Search across events, tabs, pages and tasks, opened with Ctrl+K. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const [query, setQuery] = useState("");
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const go = useCallback(
    (to: string) => () => {
      onClose();
      void navigate(to);
    },
    [navigate, onClose],
  );
  const commands = useMemo(
    () => buildCommands(state.events, { query, currentId, demo: state.mode === "demo" }, go),
    [query, state.events, state.mode, currentId, go],
  );
  const { index, setActive, onKey } = useActive(commands);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => input.current?.focus(), 0);
  }, [open, setActive]);

  const current = commands[index];
  return (
    <Modal open={open} onClose={onClose} label="Search and commands" width={600}>
      <input
        ref={input}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
        aria-label="Search events, tasks and commands"
        placeholder="Search events, tasks and commands"
        className="field text-base"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
      />
      <Results listId={listId} commands={commands} index={index} onHover={setActive} />
      {commands.length === 0 && (
        <p className="m-0 px-3 py-6 text-center text-sm text-muted">Nothing matches “{query}”.</p>
      )}
      <span className="text-xs text-muted">↑ ↓ to move · Enter to open · Esc to close</span>
    </Modal>
  );
}

interface ResultsProps {
  listId: string;
  commands: Command[];
  index: number;
  onHover: (i: number) => void;
}

/** The results, with a heading wherever the group changes. */
function Results({ listId, commands, index, onHover }: ResultsProps) {
  return (
    <div
      id={listId}
      role="listbox"
      aria-label="Results"
      className="flex max-h-[min(60vh,440px)] flex-col overflow-y-auto"
    >
      {commands.map((c, i) => (
        <div key={c.id} className="flex flex-col">
          {c.group !== commands[i - 1]?.group && (
            <span className="eyebrow px-3 pt-3 pb-1 text-muted">{c.group}</span>
          )}
          <div
            id={`${listId}-${c.id}`}
            role="option"
            aria-selected={i === index}
            tabIndex={-1}
            onMouseEnter={() => onHover(i)}
            onClick={c.run}
            // Keys go to the search box, which moves the active option; the option only takes clicks.
            onKeyDown={ignoreKey}
            className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${i === index ? "bg-sand" : ""}`}
          >
            <span className="font-medium">{c.label}</span>
            {c.hint && <span className="truncate text-xs text-muted">{c.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
