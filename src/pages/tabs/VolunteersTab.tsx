import { type FormEvent, useState } from "react";
import { useEditable } from "../../components/tasks";
import type { CommunityEvent, PlannrEvent } from "../../data/types";
import { plural } from "../../lib/format";
import { useStore } from "../../store/store";
import { Section, ShareLink, Stat, TabPage } from "./common";
import { AssignSelect, freeVolunteers, NotCommunity, ShiftGrid } from "./community";

/** /events/:id/volunteers — the shift grid, the roster and the sign-up sheet. */
export function VolunteersTab({ ev }: { ev: PlannrEvent }) {
  if (ev.layout !== "community") return <NotCommunity ev={ev} title="Volunteers" />;
  return <Volunteers ev={ev} />;
}

function Volunteers({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const needed = ev.shifts.roles.reduce((s, r) => s + r.slots.reduce((t, x) => t + x.need, 0), 0);
  const filled = ev.shifts.roles.reduce(
    (s, r) => s + r.slots.reduce((t, x) => t + Math.min(x.need, x.names.length), 0),
    0,
  );
  const gaps = ev.shifts.roles
    .flatMap((r) =>
      r.slots.map((s, i) => ({ role: r.role, slot: ev.shifts.slots[i] ?? "", gap: s.need - s.names.length })),
    )
    .filter((g) => g.gap > 0);
  const edit = (a: {
    op: "addRole" | "setNeed" | "unassign" | "addVolunteer";
    role?: string;
    slot?: number;
    need?: number;
    name?: string;
  }) => dispatch({ type: "editShifts", eventId: ev.id, ...a });
  const unassign = (roleName: string, slot: number, person: string) =>
    edit({ op: "unassign", role: roleName, slot, name: person });
  const setNeed = (roleName: string, slot: number, need: number) =>
    edit({ op: "setNeed", role: roleName, slot, need: Math.max(0, need) });
  const addRole = (e: FormEvent) => {
    e.preventDefault();
    const clean = role.trim();
    if (!clean || ev.shifts.roles.some((r) => r.role.toLowerCase() === clean.toLowerCase())) return;
    edit({ op: "addRole", role: clean });
    setRole("");
  };
  const addVolunteer = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || ev.volunteers.includes(clean)) return;
    edit({ op: "addVolunteer", name: clean });
    setName("");
  };
  return (
    <TabPage
      eyebrow={ev.name}
      title="Volunteers"
      wide
      aside={
        <ShareLink
          ev={ev}
          kind="shifts"
          label="Share the sign-up sheet"
          message={`Volunteers needed for ${ev.name}! Pick a shift that suits you:`}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Shift places" value={`${filled}/${needed}`} sub={`${needed - filled} still open`} />
        <Stat label="Volunteers" value={ev.volunteers.length} sub="on the roster" />
        <Stat
          label="Biggest gap"
          value={gaps[0] ? gaps[0].gap : 0}
          sub={gaps[0] ? `${gaps[0].role}, ${gaps[0].slot}` : "every shift is covered"}
          tone={gaps.length ? "text-rust-ink" : "text-leaf-ink"}
        />
      </div>
      <Section title="Shifts">
        <ShiftGrid slots={ev.shifts.slots} wide>
          {ev.shifts.roles.map((r) => (
            <tr key={r.role} className="border-t border-sand-2 align-top">
              <td className="py-2.5 pr-3 font-medium">{r.role}</td>
              {r.slots.map((slot, i) => {
                const gap = slot.need - slot.names.length;
                const free = freeVolunteers(ev, i);
                const label = `${r.role}, ${ev.shifts.slots[i]}`;
                return (
                  <td key={`${r.role}-${ev.shifts.slots[i]}`} className="py-2.5 pr-3">
                    <div className="flex flex-col gap-1">
                      {slot.names.map((n) => (
                        <span key={n} className="flex items-center gap-1">
                          {n}
                          {editable && (
                            <button
                              type="button"
                              className="icon-btn hover:text-rust-ink"
                              aria-label={`Take ${n} off ${label}`}
                              onClick={() => unassign(r.role, i, n)}
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
                                dispatch({ type: "assignShift", eventId: ev.id, role: r.role, slot: i, name })
                              }
                            />
                          )}
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Need one fewer for ${label}`}
                            onClick={() => setNeed(r.role, i, slot.need - 1)}
                          >
                            −
                          </button>
                          <span className="text-xs tabular text-muted">{slot.need}</span>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Need one more for ${label}`}
                            onClick={() => setNeed(r.role, i, slot.need + 1)}
                          >
                            +
                          </button>
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </ShiftGrid>
        {editable && (
          <form onSubmit={addRole} className="flex gap-2">
            <label htmlFor="role-new" className="sr-only">
              New role
            </label>
            <input
              id="role-new"
              className="field flex-1 sm:max-w-[280px]"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Add a role, e.g. First aid"
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!role.trim()}>
              Add role
            </button>
          </form>
        )}
      </Section>
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
          <form onSubmit={addVolunteer} className="flex gap-2">
            <label htmlFor="vol-new" className="sr-only">
              Add a volunteer
            </label>
            <input
              id="vol-new"
              className="field flex-1 sm:max-w-[280px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
            />
            <button type="submit" className="btn btn-secondary btn-sm" disabled={!name.trim()}>
              Add
            </button>
          </form>
        )}
        <span className="text-xs text-muted">
          Neighbours who sign up from the shared sheet are added here and to their shift.
        </span>
      </Section>
    </TabPage>
  );
}
