import { type FormEvent, useState } from "react";
import { useEditable } from "../../components/taskHooks";
import type { CommunityEvent, PlannrEvent } from "../../data/types";
import { plural } from "../../lib/format";
import { useStore } from "../../store/store";
import { AssignSelect, freeVolunteers, NotCommunity, ShiftGrid } from "./community";
import { Section, Stat, TabPage } from "./layout";
import { ShareLink } from "./ShareLink";

type ShiftEdit = {
  op: "addRole" | "setNeed" | "unassign" | "addVolunteer";
  role?: string;
  slot?: number;
  need?: number;
  name?: string;
};

/** /events/:id/volunteers — the shift grid, the roster and the sign-up sheet. */
export function VolunteersTab({ ev }: { ev: PlannrEvent }) {
  if (ev.layout !== "community") return <NotCommunity ev={ev} title="Volunteers" />;
  return <Volunteers ev={ev} />;
}

/** Places needed and filled across every shift, and the shifts still short of people, in role order. */
function shiftTotals(ev: CommunityEvent) {
  const slots = ev.shifts.roles.flatMap((r) =>
    r.slots.map((s, i) => ({ role: r.role, slot: ev.shifts.slots[i] ?? "", ...s })),
  );
  return {
    needed: slots.reduce((t, s) => t + s.need, 0),
    filled: slots.reduce((t, s) => t + Math.min(s.need, s.names.length), 0),
    gaps: slots
      .map((s) => ({ role: s.role, slot: s.slot, gap: s.need - s.names.length }))
      .filter((g) => g.gap > 0),
  };
}

function Volunteers({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const edit = (a: ShiftEdit) => dispatch({ type: "editShifts", eventId: ev.id, ...a });
  const share = (
    <ShareLink
      ev={ev}
      kind="shifts"
      label="Share the sign-up sheet"
      message={`Volunteers needed for ${ev.name}! Pick a shift that suits you:`}
    />
  );
  return (
    <TabPage eyebrow={ev.name} title="Volunteers" wide aside={share}>
      <VolunteerStats ev={ev} />
      <Section title="Shifts">
        <ShiftGrid slots={ev.shifts.slots} wide>
          {ev.shifts.roles.map((r, ri) => (
            <tr key={r.role} className="border-t border-sand-2 align-top">
              <td className="py-2.5 pr-3 font-medium">{r.role}</td>
              {r.slots.map((_, i) => (
                <ShiftCell
                  key={`${r.role}-${ev.shifts.slots[i]}`}
                  ev={ev}
                  roleIndex={ri}
                  slot={i}
                  editable={editable}
                  onEdit={edit}
                />
              ))}
            </tr>
          ))}
        </ShiftGrid>
        {editable && (
          <AddOne
            id="role-new"
            label="New role"
            placeholder="Add a role, e.g. First aid"
            button="Add role"
            taken={(role) => ev.shifts.roles.some((r) => r.role.toLowerCase() === role.toLowerCase())}
            onAdd={(role) => edit({ op: "addRole", role })}
          />
        )}
      </Section>
      <Roster ev={ev} editable={editable} onAdd={(name) => edit({ op: "addVolunteer", name })} />
    </TabPage>
  );
}

function VolunteerStats({ ev }: { ev: CommunityEvent }) {
  const { needed, filled, gaps } = shiftTotals(ev);
  const biggest = gaps[0];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Stat label="Shift places" value={`${filled}/${needed}`} sub={`${needed - filled} still open`} />
      <Stat label="Volunteers" value={ev.volunteers.length} sub="on the roster" />
      <Stat
        label="Biggest gap"
        value={biggest ? biggest.gap : 0}
        sub={biggest ? `${biggest.role}, ${biggest.slot}` : "every shift is covered"}
        tone={biggest ? "text-rust-ink" : "text-leaf-ink"}
      />
    </div>
  );
}

interface CellProps {
  ev: CommunityEvent;
  roleIndex: number;
  slot: number;
  editable: boolean;
  onEdit: (a: ShiftEdit) => void;
}

/** Who is on one role's shift, what it still needs, and controls to assign people and change the need. */
function ShiftCell({ ev, roleIndex, slot, editable, onEdit }: CellProps) {
  const { dispatch } = useStore();
  const role = ev.shifts.roles[roleIndex];
  const shift = role?.slots[slot];
  if (!role || !shift) return null;
  const gap = shift.need - shift.names.length;
  const free = freeVolunteers(ev, slot);
  const label = `${role.role}, ${ev.shifts.slots[slot]}`;
  const setNeed = (need: number) => onEdit({ op: "setNeed", role: role.role, slot, need: Math.max(0, need) });
  return (
    <td className="py-2.5 pr-3">
      <div className="flex flex-col gap-1">
        {shift.names.map((n) => (
          <span key={n} className="flex items-center gap-1">
            {n}
            {editable && (
              <button
                type="button"
                className="icon-btn hover:text-rust-ink"
                aria-label={`Take ${n} off ${label}`}
                onClick={() => onEdit({ op: "unassign", role: role.role, slot, name: n })}
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {gap > 0 && <span className="text-xs text-rust-ink">Needs {gap}</span>}
        {editable && (
          <span className="flex items-center gap-1">
            {gap > 0 && free.length > 0 && (
              <AssignSelect
                label={label}
                free={free}
                className="min-h-6 rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
                onAssign={(name) =>
                  dispatch({ type: "assignShift", eventId: ev.id, role: role.role, slot, name })
                }
              />
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Need one fewer for ${label}`}
              onClick={() => setNeed(shift.need - 1)}
            >
              −
            </button>
            <span className="text-xs tabular text-muted">{shift.need}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Need one more for ${label}`}
              onClick={() => setNeed(shift.need + 1)}
            >
              +
            </button>
          </span>
        )}
      </div>
    </td>
  );
}

function Roster({
  ev,
  editable,
  onAdd,
}: {
  ev: CommunityEvent;
  editable: boolean;
  onAdd: (name: string) => void;
}) {
  return (
    <Section
      title="Roster"
      aside={<span className="text-sm text-muted">{plural(ev.volunteers.length, "person", "people")}</span>}
    >
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {ev.volunteers.map((v) => {
          const shifts = ev.shifts.roles.flatMap((r) =>
            r.slots.flatMap((s, i) => (s.names.includes(v) ? [`${r.role} ${ev.shifts.slots[i]}`] : [])),
          );
          return (
            <li
              key={v}
              className="rounded-full bg-sand px-3 py-1 text-sm"
              title={shifts.join(", ") || "No shift yet"}
            >
              {v} <span className="text-xs text-muted">· {shifts.length || "free"}</span>
            </li>
          );
        })}
      </ul>
      {editable && (
        <AddOne
          id="vol-new"
          label="Add a volunteer"
          placeholder="Name"
          button="Add"
          taken={(n) => ev.volunteers.includes(n)}
          onAdd={onAdd}
        />
      )}
      <span className="text-xs text-muted">
        Neighbours who sign up from the shared sheet are added here and to their shift.
      </span>
    </Section>
  );
}

interface AddOneProps {
  id: string;
  label: string;
  placeholder: string;
  button: string;
  /** Already on the list, so adding it again would be a duplicate. */
  taken: (value: string) => boolean;
  onAdd: (value: string) => void;
}

/** A one-field form that adds a name to a list, ignoring blanks and duplicates. */
function AddOne({ id, label, placeholder, button, taken, onAdd }: AddOneProps) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = value.trim();
    if (!clean || taken(clean)) return;
    onAdd(clean);
    setValue("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className="field flex-1 sm:max-w-[280px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={!value.trim()}>
        {button}
      </button>
    </form>
  );
}
