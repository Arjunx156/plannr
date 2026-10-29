import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { useEditable } from "../../components/tasks";
import { Field, Modal, Pill, toneText } from "../../components/ui";
import type { Approval, CommunityEvent, Pass, Permit, PlannrEvent, Sponsor, Stall } from "../../data/types";
import { addDays, longDate, shortDate, TODAY } from "../../lib/dates";
import { inr, inrShort, plural } from "../../lib/format";
import { fundTotals } from "../../shared/derive";
import { list, slugId } from "../../shared/records";
import { toast, useStore } from "../../store/store";
import { DraftBox, newId, parseAmount, Section, ShareLink, Stat, TabPage } from "./common";

function NotCommunity({ ev, title }: { ev: PlannrEvent; title: string }) {
  return (
    <TabPage eyebrow={ev.name} title={title}>
      <p className="m-0 text-body">
        This is for community events.{" "}
        <Link to={`/events/${ev.id}`} className="link">
          Back to the overview
        </Link>
      </p>
    </TabPage>
  );
}

/** Whether this person decides on expenses: the treasurer, the owner, or anyone in the demo. */
function useDecides(ev: PlannrEvent): { decides: boolean; why?: string } {
  const { state } = useStore();
  const editable = useEditable(ev);
  if (state.mode !== "account") return { decides: true };
  const me = state.remote[ev.id];
  if (!editable) return { decides: false };
  if (me?.role === "owner" || me?.side?.trim().toLowerCase() === "treasurer") return { decides: true };
  // The server has the final say: it refuses if another member is the treasurer.
  return { decides: true, why: "If the committee has a treasurer, only they or the owner can approve." };
}

// ================================================================ funds

/** /events/:id/funds — money in, money out, expense approvals and the permits. */
export function FundsTab({ ev }: { ev: PlannrEvent }) {
  if (ev.layout !== "community") return <NotCommunity ev={ev} title="Funds" />;
  return <Funds ev={ev} />;
}

function Funds({ ev }: { ev: CommunityEvent }) {
  const editable = useEditable(ev);
  const f = fundTotals(ev);
  const balance = f.received - f.spent;
  return (
    <TabPage
      eyebrow={ev.name}
      title="Funds & permits"
      wide
      aside={
        <ShareLink
          ev={ev}
          kind="fund"
          label="Share the fund report"
          message={`Where the money for ${ev.name} comes from and where it goes, updated live:`}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Collected"
          value={inrShort(f.received)}
          sub={`of ${inrShort(f.expected)} expected`}
          tone="text-leaf-ink"
        />
        <Stat label="Spent" value={inrShort(f.spent)} sub={`of a ${inrShort(ev.funds.budget)} budget`} />
        <Stat
          label="In hand"
          value={inrShort(balance)}
          sub="collected minus spent"
          tone={balance < 0 ? "text-rust-ink" : undefined}
        />
        <Stat
          label="Waiting"
          value={f.pendingApprovals}
          sub={plural(f.pendingApprovals, "expense claim")}
          tone={f.pendingApprovals ? "text-amber-ink" : undefined}
        />
      </div>
      <Approvals ev={ev} editable={editable} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Sources ev={ev} editable={editable} />
        <Sponsors ev={ev} editable={editable} />
      </div>
      <Permits ev={ev} editable={editable} />
      <span className="text-xs text-muted">
        The fund report shows residents the totals, the approved expenses and the sponsors who've paid. Names
        of who claimed what stay with the committee.
      </span>
    </TabPage>
  );
}

function Approvals({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const { decides, why } = useDecides(ev);
  const [adding, setAdding] = useState(false);
  const approvals = [...ev.funds.approvals].sort(
    (a, b) => Number(a.status !== "pending") - Number(b.status !== "pending"),
  );
  const decide = (a: Approval, status: "approved" | "declined") => {
    dispatch({ type: "approveExpense", eventId: ev.id, approvalId: a.id, status });
    dispatch(
      toast(
        status === "approved"
          ? `Approved ${inr(a.amount)} for ${a.by}. It's in the spent total and the fund report.`
          : `Declined ${a.label}.`,
      ),
    );
  };
  return (
    <Section
      title="Expense claims"
      aside={
        editable && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            + Claim an expense
          </button>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {approvals.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{a.label}</span>
              <span className="text-xs text-muted">
                {a.by}
                {a.category ? ` · ${a.category}` : ""}
                {a.decidedBy ? ` · ${a.status} by ${a.decidedBy}` : ""}
              </span>
            </span>
            <span className="tabular font-semibold">{inr(a.amount)}</span>
            {a.status === "pending" ? (
              editable && decides ? (
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => decide(a, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => decide(a, "declined")}
                  >
                    Decline
                  </button>
                </span>
              ) : (
                <Pill tone="due">waiting for the treasurer</Pill>
              )
            ) : (
              <Pill tone={a.status === "approved" ? "ok" : "idle"}>{a.status}</Pill>
            )}
          </li>
        ))}
        {!approvals.length && (
          <li className="text-sm text-muted">
            No claims yet. Committee members claim what they spent here; the treasurer approves.
          </li>
        )}
      </ul>
      {why && approvals.some((a) => a.status === "pending") && (
        <span className="text-xs text-muted">{why}</span>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Claim an expense">
        <ClaimForm
          ev={ev}
          onDone={(a) => {
            dispatch({ type: "addRecord", eventId: ev.id, coll: "approvals", record: a });
            dispatch(toast("Claimed. It waits for the treasurer's approval."));
            setAdding(false);
          }}
        />
      </Modal>
    </Section>
  );
}

function ClaimForm({ ev, onDone }: { ev: CommunityEvent; onDone: (a: Approval) => void }) {
  const { state } = useStore();
  const [form, setForm] = useState({
    label: "",
    amount: "",
    by: state.account.user?.name ?? "",
    category: "",
  });
  const amount = parseAmount(form.amount);
  const cats = [...new Set(ev.funds.approvals.map((a) => a.category).filter((c): c is string => !!c))];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !amount || !form.by.trim()) return;
    onDone({
      id: newId("ap"),
      label: form.label.trim(),
      amount,
      by: form.by.trim(),
      status: "pending",
      ...(form.category.trim() ? { category: form.category.trim() } : {}),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="What for" htmlFor="cl-label">
        <input
          id="cl-label"
          className="field"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Marigold garlands for the stage"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" htmlFor="cl-amount">
          <input
            id="cl-amount"
            className="field"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Paid by" htmlFor="cl-by">
          <input
            id="cl-by"
            className="field"
            value={form.by}
            onChange={(e) => setForm({ ...form, by: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Category" htmlFor="cl-cat">
        <input
          id="cl-cat"
          className="field"
          list="cl-cats"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Decor"
        />
        <datalist id="cl-cats">
          {cats.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={!form.label.trim() || !amount || !form.by.trim()}
      >
        Claim {amount ? inr(amount) : ""}
      </button>
    </form>
  );
}

function Sources({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const f = fundTotals(ev);
  const own = list(ev, "sources");
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState({ label: "", expected: "" });
  const save = (id: string) => {
    const received = parseAmount(value);
    const s = own.find((x) => x.id === id);
    if (s)
      dispatch({
        type: "updateRecord",
        eventId: ev.id,
        coll: "sources",
        id,
        patch: {
          received,
          tone: received >= s.expected ? "ok" : "due",
          note: received >= s.expected ? "received" : `${inr(s.expected - received)} to collect`,
        },
      });
    setEditing(null);
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    const expected = parseAmount(adding.expected);
    if (!adding.label.trim() || !expected) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "sources",
      record: {
        id: slugId(adding.label) || newId("src"),
        label: adding.label.trim(),
        expected,
        received: 0,
        note: "to collect",
        tone: "idle",
      },
    });
    setAdding({ label: "", expected: "" });
  };
  return (
    <Section title="Where the money comes from">
      <ul className="m-0 flex list-none flex-col p-0">
        {f.sources.map((s) => {
          const mine = own.find((x) => x.id === s.id);
          return (
            <li
              key={s.id ?? s.label}
              className="flex flex-col gap-1 border-t border-sand-2 py-2.5 text-sm first:border-0"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{s.label}</span>
                {editing === s.id ? (
                  <form
                    className="flex gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save(s.id ?? "");
                    }}
                  >
                    <label htmlFor={`src-${s.id}`} className="sr-only">
                      Received for {s.label}
                    </label>
                    <input
                      id={`src-${s.id}`}
                      className="field h-8 w-28"
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Save
                    </button>
                  </form>
                ) : (
                  <span className="tabular">
                    {inr(s.received)} <span className="text-muted">/ {inr(s.expected)}</span>
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className={`text-xs ${toneText(s.tone)}`}>{s.note}</span>
                {editable && mine && editing !== s.id && (
                  <button
                    type="button"
                    className="link text-xs"
                    onClick={() => {
                      setEditing(s.id ?? null);
                      setValue(String(s.received));
                    }}
                  >
                    Update collected
                  </button>
                )}
                {!mine && (
                  <span className="text-xs text-muted">
                    from the {s.id === "sponsors" ? "sponsor list" : "stall list"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {editable && (
        <form onSubmit={add} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
          <Field label="New source" htmlFor="src-label">
            <input
              id="src-label"
              className="field"
              value={adding.label}
              onChange={(e) => setAdding({ ...adding, label: e.target.value })}
              placeholder="Resident contributions"
            />
          </Field>
          <Field label="Expected" htmlFor="src-exp">
            <input
              id="src-exp"
              className="field"
              inputMode="decimal"
              value={adding.expected}
              onChange={(e) => setAdding({ ...adding, expected: e.target.value })}
            />
          </Field>
          <button
            type="submit"
            className="btn btn-secondary btn-sm h-10"
            disabled={!adding.label.trim() || !parseAmount(adding.expected)}
          >
            Add
          </button>
        </form>
      )}
    </Section>
  );
}

function Sponsors({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const sponsors = list(ev, "sponsors");
  const [form, setForm] = useState({ name: "", tier: "", amount: "" });
  const add = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseAmount(form.amount);
    if (!form.name.trim() || !amount) return;
    const record: Sponsor = {
      id: newId("sp"),
      name: form.name.trim(),
      tier: form.tier.trim() || "Supporter",
      amount,
      received: 0,
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "sponsors", record });
    setForm({ name: "", tier: "", amount: "" });
  };
  return (
    <Section title="Sponsors">
      <ul className="m-0 flex list-none flex-col p-0">
        {sponsors.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-2 border-t border-sand-2 py-2.5 text-sm first:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">{s.tier}</span>
            </span>
            <span className="tabular">{inr(s.amount)}</span>
            {s.received >= s.amount ? (
              <Pill tone="ok">paid</Pill>
            ) : editable ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  dispatch({
                    type: "updateRecord",
                    eventId: ev.id,
                    coll: "sponsors",
                    id: s.id,
                    patch: { received: s.amount },
                  });
                  dispatch(
                    toast(`${s.name}'s ${inr(s.amount)} is in. Their name now shows on the fund report.`),
                  );
                }}
              >
                Received
              </button>
            ) : (
              <Pill tone="due">due</Pill>
            )}
          </li>
        ))}
        {!sponsors.length && <li className="text-sm text-muted">No sponsors yet.</li>}
      </ul>
      {editable && (
        <form onSubmit={add} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
          <Field label="Sponsor" htmlFor="sp-name">
            <input
              id="sp-name"
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Tier" htmlFor="sp-tier">
            <input
              id="sp-tier"
              className="field"
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
              placeholder="Gold"
            />
          </Field>
          <Field label="Amount" htmlFor="sp-amount">
            <input
              id="sp-amount"
              className="field"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <button
            type="submit"
            className="btn btn-secondary btn-sm h-10"
            disabled={!form.name.trim() || !parseAmount(form.amount)}
          >
            Add
          </button>
        </form>
      )}
    </Section>
  );
}

function permitLetter(ev: CommunityEvent, p: Permit): string {
  return `To
The ${p.label.replace(/^(permission|permit|noc)\s*(from|for)?\s*/i, "") || "Authority"}

Subject: Request for ${p.label.toLowerCase()} for ${ev.name} on ${longDate(ev.date)}

Respected Sir / Madam,

On behalf of the organising committee, we request ${p.label.toLowerCase()} for ${ev.name}, to be held on ${longDate(ev.date)}. We expect about ${ev.passes.capacity} people. The committee will arrange volunteers for crowd management, keep the area clean and follow every condition you set.

We would be grateful for your approval at the earliest.

Yours faithfully,
For the organising committee`;
}

function Permits({ ev, editable }: { ev: CommunityEvent; editable: boolean }) {
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

// ================================================================ volunteers

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
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table */}
        <section className="scroll-x" aria-label="Volunteer shifts by role and time" tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 font-medium">Role</th>
                {ev.shifts.slots.map((s) => (
                  <th key={s} className="py-2 font-medium">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ev.shifts.roles.map((r) => (
                <tr key={r.role} className="border-t border-sand-2 align-top">
                  <td className="py-2.5 pr-3 font-medium">{r.role}</td>
                  {r.slots.map((slot, i) => {
                    const gap = slot.need - slot.names.length;
                    const busy = new Set(ev.shifts.roles.flatMap((x) => x.slots[i]?.names ?? []));
                    const free = ev.volunteers.filter((v) => !busy.has(v));
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
                                  className="text-xs text-muted hover:text-rust-ink"
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
                                <select
                                  className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
                                  value=""
                                  aria-label={`Assign a volunteer to ${label}`}
                                  onChange={(e) =>
                                    e.target.value &&
                                    dispatch({
                                      type: "assignShift",
                                      eventId: ev.id,
                                      role: r.role,
                                      slot: i,
                                      name: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Assign…</option>
                                  {free.map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <button
                                type="button"
                                className="text-xs text-muted"
                                aria-label={`Need one fewer for ${label}`}
                                onClick={() => setNeed(r.role, i, slot.need - 1)}
                              >
                                −
                              </button>
                              <span className="text-xs tabular text-muted">{slot.need}</span>
                              <button
                                type="button"
                                className="text-xs text-muted"
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
            </tbody>
          </table>
        </section>
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

// ================================================================ stalls and passes

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
        <ShareLink
          ev={ev}
          kind="gate"
          label="Send the gate link"
          message={`Gate check-in for ${ev.name}. Find the flat or name and tap +1 as people come in:`}
        />
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
