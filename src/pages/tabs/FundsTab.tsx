import { type FormEvent, useState } from "react";
import { useEditable } from "../../components/tasks";
import { Field, Modal, TextField } from "../../components/ui";
import type { Approval, CommunityEvent, PlannrEvent } from "../../data/types";
import { inr, inrShort, plural } from "../../lib/format";
import { fundTotals } from "../../shared/derive";
import { toast, useStore } from "../../store/store";
import { newId, parseAmount, Section, ShareLink, Stat, TabPage, WhatForAmount } from "./common";
import { ApprovalDecision, NotCommunity, useDecides } from "./community";
import { Permits } from "./funds/Permits";
import { Sources } from "./funds/Sources";
import { Sponsors } from "./funds/Sponsors";

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
            <ApprovalDecision
              approval={a}
              canDecide={editable && decides}
              waiting="waiting for the treasurer"
              onDecide={(status) => decide(a, status)}
            />
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
      <WhatForAmount
        id="cl"
        label={form.label}
        amount={form.amount}
        placeholder="Marigold garlands for the stage"
        onChange={(patch) => setForm({ ...form, ...patch })}
        beside={
          <TextField id="cl-by" label="Paid by" value={form.by} onChange={(by) => setForm({ ...form, by })} />
        }
      />
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
