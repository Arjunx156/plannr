import { type FormEvent, useState } from "react";
import { Modal, Pill, toneText } from "../../../components/ui";
import type { CommunityEvent, Permit } from "../../../data/types";
import { addDays, longDate, shortDate, TODAY } from "../../../lib/dates";
import { list } from "../../../shared/records";
import { toast, useStore } from "../../../store/store";
import { DraftBox, newId, Section } from "../common";

/** Who an application goes to, from what the permit is for. */
function addressee(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("police")) return "The Station House Officer\nPolice Station";
  if (l.includes("fire")) return "The Station Officer\nFire and Rescue Services";
  if (/corporation|municipal/.test(l)) return "The Secretary\nCorporation Office";
  if (l.includes("panchayat")) return "The Secretary\nGrama Panchayat Office";
  return "The Officer concerned";
}

function permitLetter(ev: CommunityEvent, p: Permit): string {
  return `To
${addressee(p.label)}

Subject: Request for ${p.label.toLowerCase()} for ${ev.name} on ${longDate(ev.date)}

Respected Sir / Madam,

On behalf of the organising committee, we request ${p.label.toLowerCase()} for ${ev.name}, to be held on ${longDate(ev.date)}. We expect about ${ev.passes.capacity} people. The committee will arrange volunteers for crowd management, keep the area clean and follow every condition you set.

We would be grateful for your approval at the earliest.

Yours faithfully,
For the organising committee`;
}

/** Permits the event needs, who is filing each, and a drafted application letter. */
export function Permits({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const permits = list(ev, "permits");
  const [writing, setWriting] = useState<(Permit & { id: string }) | null>(null);
  const [label, setLabel] = useState("");
  const set = (p: Permit & { id: string }, patch: Partial<Permit>) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "permits", id: p.id, patch });
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "permits",
      record: {
        id: newId("pm"),
        label: label.trim(),
        status: "To apply",
        tone: "idle",
        permit: true,
        due: addDays(ev.date, -21),
      },
    });
    setLabel("");
  };
  return (
    <Section title="Permits and bookings">
      <ul className="m-0 flex list-none flex-col p-0">
        {permits.map((p) => {
          const cleared = p.tone === "ok";
          const late = !cleared && p.due && p.due < TODAY;
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{p.label}</span>
                <span className={`text-xs ${late ? "text-rust-ink" : toneText(p.tone)}`}>
                  {p.status}
                  {p.due && !cleared ? ` · ${late ? "was due" : "apply by"} ${shortDate(p.due)}` : ""}
                  {p.letter ? " · letter drafted" : ""}
                </span>
              </span>
              {editable && !cleared && (
                <span className="flex flex-wrap gap-1.5">
                  {p.permit !== false && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWriting(p)}>
                      {p.letter ? "Letter" : "Draft letter"}
                    </button>
                  )}
                  {p.tone === "idle" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => set(p, { status: "Applied, waiting", tone: "due" })}
                    >
                      Applied
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => set(p, { status: p.permit === false ? "Booked" : "Cleared", tone: "ok" })}
                  >
                    {p.permit === false ? "Booked" : "Cleared"}
                  </button>
                </span>
              )}
              {cleared && <Pill tone="ok">{p.status}</Pill>}
            </li>
          );
        })}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="pm-new" className="sr-only">
            New permit
          </label>
          <input
            id="pm-new"
            className="field flex-1"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Police permission for the procession"
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!label.trim()}>
            Add
          </button>
        </form>
      )}
      <Modal open={!!writing} onClose={() => setWriting(null)} title={writing?.label ?? "Letter"} width={620}>
        {writing && (
          <DraftBox
            task="permit"
            rows={14}
            context={{ event: ev.name, date: ev.date, permit: writing.label, expected: ev.passes.capacity }}
            fallback={writing.letter ?? permitLetter(ev, writing)}
            saveLabel="Keep with the permit"
            onSave={(letter) => {
              set(writing, { letter });
              dispatch(toast("Saved with the permit."));
              setWriting(null);
            }}
          />
        )}
      </Modal>
    </Section>
  );
}
