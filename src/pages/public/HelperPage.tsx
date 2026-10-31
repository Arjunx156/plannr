import { type ReactNode, useState } from "react";
import { dueLabel } from "../../lib/dates";
import { fill } from "../../lib/guestText";
import type { LinkText } from "../../lib/linkText/en";
import type { HelperView } from "../../shared/public";
import { type Act, Card, PublicShell, useLinkLang } from "./shell";

/** "Two things for you", "One thing for you", or "All done" in the helper's language. */
function helperStatus(open: number, t: LinkText): string {
  if (!open) return t.helperDone;
  return open === 1 ? t.helperOne : fill(t.helperMany, { n: open });
}

/** A helper's page: their tasks and the day's run sheet, in their language. */
export function HelperPage({ view, act, preview }: { view: HelperView; act?: Act; preview?: ReactNode }) {
  const [busy, setBusy] = useState("");
  const toggle = async (actions: unknown[], key: string) => {
    if (!act) return;
    setBusy(key);
    try {
      await act(actions);
    } finally {
      setBusy("");
    }
  };
  const open = view.tasks.filter((t) => !t.done);
  const { t, shell } = useLinkLang(view.event);
  return (
    <PublicShell
      event={view.event}
      eyebrow={fill(t.helperList, { name: view.helper })}
      preview={preview}
      {...shell}
    >
      <p className="m-0 text-[17px]">
        {fill(t.helperHello, { name: view.helper })} {helperStatus(open.length, t)}
      </p>
      <Card label={t.tasks}>
        <ul className="m-0 flex list-none flex-col p-0">
          {view.tasks.map((task) => {
            const due = dueLabel(task.due);
            return (
              <li key={task.id} className="flex items-start gap-3 border-t border-sand-2 py-3 first:border-0">
                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={!act || busy === task.id}
                  aria-label={task.title}
                  onChange={() => toggle([{ type: "toggleTask", taskId: task.id }], task.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-leaf)]"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-medium ${task.done ? "text-muted line-through" : ""}`}>
                    {task.title}
                  </span>
                  {task.note && <span className="text-xs text-muted">{task.note}</span>}
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${due.late && !task.done ? "text-rust-ink" : "text-body"}`}
                >
                  {due.text}
                </span>
              </li>
            );
          })}
          {view.tasks.length === 0 && <li className="text-sm text-muted">{t.noTasks}</li>}
        </ul>
      </Card>
      {view.checklist.length > 0 && (
        <Card label={t.toBring}>
          <h2 className="font-serif text-[22px]">{t.toBring}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {view.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-sand-2 py-2.5 first:border-0">
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!act || busy === c.id}
                  aria-label={c.label}
                  onChange={() =>
                    toggle(
                      [{ type: "updateRecord", coll: "checklist", id: c.id, patch: { done: !c.done } }],
                      c.id,
                    )
                  }
                  className="h-5 w-5 accent-[var(--color-leaf)]"
                />
                <span className={c.done ? "text-muted line-through" : ""}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PublicShell>
  );
}
