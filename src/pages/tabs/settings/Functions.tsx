import { useState } from "react";
import { Modal } from "../../../components/overlays";
import { Pill } from "../../../components/ui";
import type { PlannrEvent } from "../../../data/types";
import { dayLine } from "../../../lib/dates";
import { functionsOf } from "../../../shared/eventLists";
import { Section } from "../layout";
import { FunctionForm } from "./functionForm";

export function Functions({ ev, editable }: { ev: PlannrEvent; editable: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const fns = functionsOf(ev);
  const current = open === "new" ? undefined : fns.find((f) => f.id === open);
  return (
    <Section
      title="Functions"
      aside={
        editable && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen("new")}>
            + Add a function
          </button>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {fns.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-sand-2 py-2.5 first:border-0"
          >
            <span className="flex flex-col text-sm">
              <span className="font-semibold">
                {f.label} {f.private && <Pill tone="idle">family only</Pill>}
              </span>
              <span className="text-xs text-muted">
                {dayLine(f.date, f.time, f.place, !!f.capacity && `seats ${f.capacity}`)}
              </span>
            </span>
            {editable && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(f.id)}>
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={current ? `Edit ${current.label}` : "Add a function"}
        width={520}
      >
        {open && <FunctionForm key={open} ev={ev} fn={current} onClose={() => setOpen(null)} />}
      </Modal>
    </Section>
  );
}
