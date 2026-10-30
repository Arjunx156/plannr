import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill } from "../../components/ui";
import type { CommunityEvent, Pass, PlannrEvent, Stall } from "../../data/types";
import { inr, plural } from "../../lib/format";
import { fundTotals } from "../../shared/derive";
import { list } from "../../shared/records";
import { useStore } from "../../store/store";
import { newId, parseAmount, Section, ShareLink, Stat, TabPage } from "./common";
import { NotCommunity } from "./community";

/** /events/:id/stalls — stall requests, fees, passes and the gate. */
export function StallsTab({ ev }: { ev: PlannrEvent }) {
  if (ev.layout !== "community") return <NotCommunity ev={ev} title="Stalls & passes" />;
  return <Stalls ev={ev} />;
}

function Stalls({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const f = fundTotals(ev);
  const stalls = list(ev, "stalls");
  const requests = stalls.filter((s) => s.status === "requested");
  const confirmed = stalls.filter((s) => s.status === "confirmed");
  const [adding, setAdding] = useState(false);
  const set = (s: Stall, patch: Partial<Stall>) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "stalls", id: s.id, patch });
  return (
    <TabPage eyebrow={ev.name} title="Stalls & passes" wide>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Stalls"
          value={`${f.stalls.booked}/${f.stalls.total}`}
          sub={`${f.stalls.requested} requests waiting`}
        />
        <Stat
          label="Fees paid"
          value={`${f.stalls.paid}/${confirmed.length}`}
          sub={inr(confirmed.filter((s) => s.paid).reduce((t, s) => t + s.fee, 0))}
        />
        <Stat label="Passes" value={f.passes.issued} sub={`of ${f.passes.capacity} capacity`} />
        <Stat label="Inside" value={f.passes.checkedIn} sub="checked in at the gate" />
      </div>
      <Section
        title="Stalls"
        aside={
          <span className="flex flex-wrap gap-2">
            <ShareLink
              ev={ev}
              kind="stalls"
              label="Share stall requests"
              message={`Want a stall at ${ev.name}? Request one here:`}
            />
            {editable && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
                + Stall
              </button>
            )}
          </span>
        }
      >
        {requests.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-line bg-cream p-3.5">
            <span className="font-semibold text-amber-ink">
              {plural(requests.length, "request")} to decide
            </span>
            {requests.map((s) => (
              <span key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <strong>{s.name}</strong> · {s.owner}
                  {s.category ? ` · ${s.category}` : ""}
                  {s.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${s.phone}`} className="link">
                        call
                      </a>
                    </>
                  )}
                </span>
                {editable && (
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={f.stalls.booked >= f.stalls.total}
                      onClick={() => set(s, { status: "confirmed" })}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        dispatch({ type: "removeRecord", eventId: ev.id, coll: "stalls", id: s.id })
                      }
                    >
                      Decline
                    </button>
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
        <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2">
          {confirmed.map((s) => (
            <li key={s.id} className="flex items-center gap-2 border-t border-sand-2 py-2 text-sm">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted">
                  {s.owner}
                  {s.category ? ` · ${s.category}` : ""}
                </span>
              </span>
              <span className="tabular text-xs">{inr(s.fee)}</span>
              {editable ? (
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={s.paid}
                    onChange={(e) => set(s, { paid: e.target.checked })}
                  />
                  paid
                </label>
              ) : (
                <Pill tone={s.paid ? "ok" : "due"}>{s.paid ? "paid" : "due"}</Pill>
              )}
            </li>
          ))}
        </ul>
        <Modal open={adding} onClose={() => setAdding(false)} title="Add a stall">
          <StallForm
            fee={Math.max(0, ...stalls.map((s) => s.fee))}
            onAdd={(s) => {
              dispatch({ type: "addRecord", eventId: ev.id, coll: "stalls", record: s });
              setAdding(false);
            }}
          />
        </Modal>
      </Section>
      <Passes ev={ev} editable={editable} />
    </TabPage>
  );
}

function StallForm({ fee, onAdd }: { fee: number; onAdd: (s: Stall) => void }) {
  const [form, setForm] = useState({
    name: "",
    owner: "",
    phone: "",
    category: "",
    fee: fee ? String(fee) : "",
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.owner.trim()) return;
    onAdd({
      id: newId("st"),
      name: form.name.trim(),
      owner: form.owner.trim(),
      fee: parseAmount(form.fee),
      paid: false,
      status: "confirmed",
      ...(form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {}),
      ...(form.category.trim() ? { category: form.category.trim() } : {}),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Stall name" htmlFor="st-name">
        <input
          id="st-name"
          className="field"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ammachi's pickles"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Run by" htmlFor="st-owner">
          <input
            id="st-owner"
            className="field"
            value={form.owner}
            onChange={(e) => setForm({ ...form, owner: e.target.value })}
            placeholder="Flat B-204"
          />
        </Field>
        <Field label="Phone" htmlFor="st-phone">
          <input
            id="st-phone"
            className="field"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Category" htmlFor="st-cat">
          <input
            id="st-cat"
            className="field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Food"
          />
        </Field>
        <Field label="Fee (₹)" htmlFor="st-fee">
          <input
            id="st-fee"
            className="field"
            inputMode="decimal"
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: e.target.value })}
          />
        </Field>
      </div>
      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={!form.name.trim() || !form.owner.trim()}
      >
        Add
      </button>
    </form>
  );
}

function Passes({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const passes = list(ev, "passes");
  const f = fundTotals(ev);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", count: "2", phone: "" });
  const shown = passes
    .filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 60);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const count = Math.max(1, Math.min(20, Number(form.count) || 1));
    if (!form.name.trim()) return;
    if (
      f.passes.issued + count > ev.passes.capacity &&
      !window.confirm(`That takes passes past the ${ev.passes.capacity} capacity. Issue anyway?`)
    )
      return;
    const record: Pass = {
      id: newId("ps"),
      name: form.name.trim(),
      count,
      ...(form.phone.trim() ? { phone: form.phone.replace(/[^\d+]/g, "") } : {}),
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "passes", record });
    setForm({ name: "", count: "2", phone: "" });
  };
  return (
    <Section
      title="Passes"
      aside={
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
      }
    >
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
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 border-t border-sand-2 py-2 text-sm"
          >
            <span className="font-medium">{p.name}</span>
            <span className="flex items-center gap-2 text-xs text-muted">
              {p.checkedIn
                ? `${p.checkedIn}/${p.count} in`
                : `${p.count} ${p.count === 1 ? "pass" : "passes"}`}
              {editable && (
                <button
                  type="button"
                  className="link text-xs"
                  aria-label={`Cancel the pass for ${p.name}`}
                  onClick={() => dispatch({ type: "removeRecord", eventId: ev.id, coll: "passes", id: p.id })}
                >
                  cancel
                </button>
              )}
            </span>
          </li>
        ))}
        {!passes.length && <li className="text-sm text-muted">No passes issued yet.</li>}
      </ul>
      {passes.length > shown.length && (
        <span className="text-xs text-muted">
          Showing {shown.length} of {passes.length}. Search to find the rest.
        </span>
      )}
      {editable && (
        <form
          onSubmit={add}
          className="grid grid-cols-[1fr_80px] items-end gap-2 sm:grid-cols-[1fr_80px_1fr_auto]"
        >
          <Field label="Flat or name" htmlFor="ps-name">
            <input
              id="ps-name"
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="C-1102 · Iyer"
            />
          </Field>
          <Field label="Passes" htmlFor="ps-count">
            <input
              id="ps-count"
              className="field"
              type="number"
              min={1}
              max={20}
              value={form.count}
              onChange={(e) => setForm({ ...form, count: e.target.value })}
            />
          </Field>
          <Field label="Phone" htmlFor="ps-phone">
            <input
              id="ps-phone"
              className="field"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <button type="submit" className="btn btn-secondary btn-sm h-10" disabled={!form.name.trim()}>
            Issue
          </button>
        </form>
      )}
    </Section>
  );
}
