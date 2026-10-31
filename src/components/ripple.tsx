import { useState } from "react";
import type { EventAction } from "../shared/engine";
import { chosenActions, type Ripple } from "../shared/ripple";
import { toast, useStore } from "../store/store";
import { Modal } from "./overlays";

/**
 * The ripple preview: every consequence of a change, each with a tick box, and nothing
 * applied until the planner says yes. Lines that only warn are shown but change nothing.
 */
export function RipplePreview({
  ripple,
  onDone,
  onCancel,
  applyLabel = "Apply",
}: {
  ripple: Ripple;
  onDone?: (applied: EventAction[]) => void;
  onCancel?: () => void;
  applyLabel?: string;
}) {
  const { dispatch } = useStore();
  const [kept, setKept] = useState(
    () => new Set(ripple.lines.filter((l) => l.optional && l.actions.length > 0).map((l) => l.id)),
  );
  const actionable = ripple.lines.filter((l) => l.actions.length);
  const apply = (all: boolean) => {
    const set = all ? new Set(ripple.lines.map((l) => l.id)) : kept;
    const actions = chosenActions(ripple, set);
    for (const a of actions) dispatch(a as Parameters<typeof dispatch>[0]);
    dispatch(
      toast(
        `Applied ${actions.length} ${actions.length === 1 ? "change" : "changes"}. Undo any of them from History.`,
      ),
    );
    onDone?.(actions);
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-peacock-line bg-peacock-tint p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {ripple.title} · {actionable.length} connected {actionable.length === 1 ? "change" : "changes"}
        </span>
        <span className="rounded-full bg-peacock px-2 py-0.5 text-xs font-semibold text-white">Preview</span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {ripple.lines.map((l) => (
          <li
            key={l.id}
            className="grid grid-cols-[20px_minmax(0,110px)_1fr] items-baseline gap-2 border-t border-peacock-line py-2 text-sm first:border-0"
          >
            {l.actions.length > 0 ? (
              <input
                type="checkbox"
                aria-label={l.title}
                checked={!l.optional || kept.has(l.id)}
                disabled={!l.optional}
                onChange={(e) =>
                  setKept((k) => {
                    const next = new Set(k);
                    if (e.target.checked) next.add(l.id);
                    else next.delete(l.id);
                    return next;
                  })
                }
                className="h-4 w-4 accent-[var(--color-peacock)]"
              />
            ) : (
              <span aria-hidden="true" className="text-center text-muted">
                ·
              </span>
            )}
            <span className="font-medium text-body">{l.title}</span>
            <span className={l.warn ? "font-medium text-rust-ink" : ""}>{l.detail}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm bg-peacock" onClick={() => apply(true)}>
          {applyLabel} all
        </button>
        {actionable.some((l) => l.optional) && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => apply(false)}>
            Apply selected
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Not now
          </button>
        )}
      </div>
      <span className="text-xs text-muted">
        Everyone working on the plan sees what changed and who changed it.
      </span>
    </div>
  );
}

/** The preview in a dialog, for changes started from a button. */
export function RippleDialog({ ripple, onClose }: { ripple: Ripple | null; onClose: () => void }) {
  return (
    <Modal open={!!ripple} onClose={onClose} label={ripple?.title ?? "Preview"} width={560}>
      {ripple && <RipplePreview ripple={ripple} onDone={onClose} onCancel={onClose} />}
    </Modal>
  );
}
