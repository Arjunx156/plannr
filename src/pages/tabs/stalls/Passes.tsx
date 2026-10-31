import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { bindText, TextField } from "../../../components/fields";
import type { Pass } from "../../../data/communityTypes";
import type { CommunityEvent } from "../../../data/types";
import { fundTotals } from "../../../shared/balances";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { newId } from "../ids";
import { Section } from "../layout";
import { ShareLink } from "../ShareLink";

/** Passes listed at once; a search finds the rest. */
const SHOWN = 60;
const EMPTY_FORM = { name: "", count: "2", phone: "" };

/** Entry passes by flat or name, with check-ins from the gate. */
export function Passes({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const passes = list(ev, "passes");
  const aside = (
    <span className="flex flex-wrap items-center gap-2">
      {passes.length > 0 && (
        <Link to={`/events/${ev.id}/passes`} className="btn btn-ghost btn-sm">
          Print passes
        </Link>
      )}
      <ShareLink
        ev={ev}
        kind="gate"
        label="Send the gate link"
        message={`Gate check-in for ${ev.name}. Scan each pass, or find the flat or name and tap +1:`}
      />
    </span>
  );
  return (
    <Section title="Passes" aside={aside}>
      <PassList ev={ev} passes={passes} editable={editable} />
      {editable && <IssuePass ev={ev} />}
    </Section>
  );
}

function PassList({ ev, passes, editable }: { ev: CommunityEvent; passes: Pass[]; editable: boolean }) {
  const { dispatch } = useStore();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = passes.filter((p) => !needle || p.name.toLowerCase().includes(needle)).slice(0, SHOWN);
  const cancel = (p: Pass) => dispatch({ type: "removeRecord", eventId: ev.id, coll: "passes", id: p.id });
  return (
    <>
      {passes.length > 0 && (
        <>
          <label htmlFor="pass-q" className="sr-only">
            Find a pass
          </label>
          <input
            id="pass-q"
            className="field sm:max-w-[280px]"
            placeholder="Find a flat or name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </>
      )}
      <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => (
          <PassRow key={p.id} p={p} onCancel={editable ? () => cancel(p) : undefined} />
        ))}
        {passes.length === 0 && <li className="text-sm text-muted">No passes issued yet.</li>}
      </ul>
      {passes.length > shown.length && (
        <span className="text-xs text-muted">
          Showing {shown.length} of {passes.length}. Search to find the rest.
        </span>
      )}
    </>
  );
}

function PassRow({ p, onCancel }: { p: Pass; onCancel?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm">
      <span className="font-medium">{p.name}</span>
      <span className="flex items-center gap-2 text-xs text-muted">
        {p.checkedIn ? `${p.checkedIn}/${p.count} in` : `${p.count} ${p.count === 1 ? "pass" : "passes"}`}
        {onCancel && (
          <button
            type="button"
            className="link text-xs"
            aria-label={`Cancel the pass for ${p.name}`}
            onClick={onCancel}
          >
            cancel
          </button>
        )}
      </span>
    </li>
  );
}

/** Issues passes for one flat, asking first when that would go past the capacity. */
function IssuePass({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const [form, setForm] = useState(EMPTY_FORM);
  const field = bindText(form, setForm);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const count = Math.max(1, Math.min(20, Number(form.count) || 1));
    if (!name) return;
    const { capacity } = ev.passes;
    const over = fundTotals(ev).passes.issued + count > capacity;
    if (over && !window.confirm(`That takes passes past the ${capacity} capacity. Issue anyway?`)) return;
    const phone = form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {};
    const record: Pass = { id: newId("ps"), name, count, ...phone };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "passes", record });
    setForm(EMPTY_FORM);
  };
  return (
    <form
      onSubmit={add}
      className="grid grid-cols-[1fr_80px] items-end gap-2 sm:grid-cols-[1fr_80px_1fr_auto]"
    >
      <TextField id="ps-name" label="Flat or name" {...field("name")} placeholder="C-1102 · Iyer" />
      <TextField id="ps-count" label="Passes" {...field("count")} type="number" min={1} max={20} />
      <TextField id="ps-phone" label="Phone" {...field("phone")} inputMode="tel" />
      <button type="submit" className="btn btn-secondary btn-sm h-10" disabled={!form.name.trim()}>
        Issue
      </button>
    </form>
  );
}
