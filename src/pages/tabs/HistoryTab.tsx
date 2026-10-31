import { useCallback, useState } from "react";
import { LoadError, useRemote } from "../../components/remote";
import { useEditable } from "../../components/taskHooks";
import { Pill, Spinner } from "../../components/ui";
import type { PlannrEvent } from "../../data/types";
import { api } from "../../lib/api";
import { initials, timeAgo } from "../../lib/format";
import type { HistoryEntry } from "../../shared/types";
import { toast, useStore } from "../../store/store";
import { TabPage } from "./layout";
import { NeedsAccount } from "./NeedsAccount";

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

/** Each entry with the day heading it starts, if it's the first of its day. */
function withDayHeadings(entries: HistoryEntry[]): { entry: HistoryEntry; heading?: string }[] {
  return entries.map((entry, i) => {
    const day = dayHeading(entry.at);
    const previous = entries[i - 1];
    return { entry, heading: previous && dayHeading(previous.at) === day ? undefined : day };
  });
}

/** One change: who made it and when, with Undo (or Redo) for actions planners can reverse. */
function HistoryRow({
  entry: h,
  heading,
  first,
  editable,
  busy,
  onUndo,
}: {
  entry: HistoryEntry;
  heading?: string;
  first: boolean;
  editable: boolean;
  /** The entry being undone or redone, if any. */
  busy: string;
  onUndo: () => void;
}) {
  const verb = h.undone ? "Redo" : "Undo";
  return (
    <li className={`flex flex-col ${first ? "" : "border-t border-sand-2"}`}>
      {heading && <span className="eyebrow px-5 pt-4 text-muted">{heading}</span>}
      <div className="flex items-start gap-3 px-5 py-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-[11px] font-semibold"
        >
          {initials(h.by ?? "?")}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-sm font-medium ${h.undone ? "text-muted line-through" : ""}`}>
            {h.summary}
          </span>
          <span className="text-xs text-muted">
            {h.by ?? "Someone"} · {timeAgo(h.at)}
            {h.undone && " · undone"}
          </span>
        </span>
        {h.kind !== "action" && <Pill tone="idle">{h.kind}</Pill>}
        {h.kind === "action" && editable && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!!busy}
            onClick={onUndo}
            aria-label={`${verb} ${h.summary}`}
          >
            {busy === h.id ? "…" : verb}
          </button>
        )}
      </div>
    </li>
  );
}

export function HistoryTab({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch, sync } = useStore();
  const editable = useEditable(ev);
  const version = state.remote[ev.id]?.version;
  const account = state.mode === "account";
  const load = useCallback(() => api.history(ev.id), [ev.id]);
  // Loaded again whenever the plan's version moves, by this person or anyone else.
  const history = useRemote(account ? load : undefined, version);
  const list = history.data;
  const [busy, setBusy] = useState("");

  if (!account)
    return (
      <NeedsAccount ev={ev} title="History">
        With an account, every change to the plan is kept here: who made it, and when. Any change can be
        undone on its own, even after other changes have come in.
      </NeedsAccount>
    );

  const undo = async (entry: HistoryEntry) => {
    if (sync.has(ev.id)) {
      dispatch(toast("Saving your latest change first. Try again in a moment."));
      return;
    }
    setBusy(entry.id);
    try {
      const plan = await api.undo(ev.id, entry.id, entry.undone);
      dispatch({ type: "syncPlan", plan });
      dispatch(toast(`${entry.undone ? "Redone" : "Undone"}: ${entry.summary}`));
    } catch (e) {
      dispatch(toast((e as Error).message));
    }
    setBusy("");
  };

  return (
    <TabPage eyebrow={ev.name} title="History">
      <p className="m-0 max-w-[640px] text-body">
        Every change to the plan, newest first. Undo one and Plannr rebuilds the plan without it, keeping
        everything that came after.
      </p>
      {history.error && <LoadError what="the history" error={history.error} onRetry={history.reload} />}
      {list === null && !history.error && (
        <div className="flex justify-center py-10">
          <Spinner label="Loading history" />
        </div>
      )}
      {list?.length === 0 && (
        <p className="m-0 rounded-2xl border border-dashed border-line-2 p-8 text-center text-body">
          No changes yet. Tick off a task or adjust the budget and it shows up here.
        </p>
      )}
      {!!list?.length && (
        <ol className="m-0 flex list-none flex-col rounded-2xl border border-line bg-surface p-0">
          {withDayHeadings(list).map(({ entry, heading }, i) => (
            <HistoryRow
              key={entry.id}
              entry={entry}
              heading={heading}
              first={i === 0}
              editable={editable}
              busy={busy}
              onUndo={() => undo(entry)}
            />
          ))}
        </ol>
      )}
    </TabPage>
  );
}
