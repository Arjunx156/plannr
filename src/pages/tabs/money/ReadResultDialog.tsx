import { useState } from "react";
import { Field } from "../../../components/fields";
import { Modal } from "../../../components/overlays";
import type { LineItem, Payment, PayStatus } from "../../../data/budgetTypes";
import type { PersonalEvent } from "../../../data/types";
import type { ReadResult } from "../../../lib/ai";
import { addDays, longDate, shortDate, TODAY } from "../../../lib/dates";
import { inr, plural } from "../../../lib/format";
import { toast, useStore } from "../../../store/store";
import { newId } from "../ids";

// ---------------------------------------------------------------- reading a bill
/** Days until a payment read from a document falls due when the document doesn't say. */
const DEFAULT_DUE_DAYS = 14;
/** A paid bill, an unpaid one, or a quote (kept as an estimate until it's booked). */
function itemStatus(paid: boolean, kind: ReadResult["kind"]): PayStatus {
  if (paid) return "paid";
  return kind === "quote" ? "quote" : "unpaid";
}
/** The budget line a read document becomes. */
function lineItemFrom(result: ReadResult, total: number, paid: boolean): LineItem {
  return {
    id: newId("li"),
    name: result.summary || result.vendor || "From a document",
    vendor: result.vendor ?? "",
    amount: total,
    status: itemStatus(paid, result.kind),
    ...(result.kind === "quote" ? { estimate: true } : {}),
  };
}
/** The instalments a document lists, as payments on the schedule under one category. */
function paymentsFrom(result: ReadResult, categoryId: string): Payment[] {
  return result.payments
    .filter((p) => p.amount > 0)
    .map((p) => ({
      id: newId("pay"),
      label: p.label,
      amount: p.amount,
      date: p.date ?? addDays(TODAY, DEFAULT_DUE_DAYS),
      paid: false,
      categoryId,
    }));
}
export function ReadResultDialog({
  ev,
  result,
  onClose,
}: {
  ev: PersonalEvent;
  result: ReadResult | null;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const guess = result?.category
    ? ev.budget.categories.find((c) => c.name.toLowerCase() === result.category?.toLowerCase())?.id
    : undefined;
  const [categoryId, setCategoryId] = useState("");
  const chosen = categoryId || guess || ev.budget.categories[0]?.id || "";
  if (!result) return null;
  const total = result.total ?? result.items.reduce((s, i) => s + i.amount, 0);
  const add = (paid: boolean) => {
    if (!chosen || !total) return;
    dispatch({
      type: "addLineItem",
      eventId: ev.id,
      categoryId: chosen,
      item: lineItemFrom(result, total, paid),
      spent: paid ? total : 0,
    });
    for (const record of paymentsFrom(result, chosen))
      dispatch({ type: "addRecord", eventId: ev.id, coll: "payments", record });
    dispatch(
      toast(
        result.payments.length > 0
          ? `Added, with ${plural(result.payments.length, "payment")} on the schedule.`
          : "Added to the budget.",
      ),
    );
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="What Plannr read" width={560}>
      <div className="flex flex-col gap-3 text-sm">
        <span>
          A {result.kind === "other" ? "document" : result.kind}
          {result.vendor ? ` from ${result.vendor}` : ""}
          {result.date ? `, dated ${longDate(result.date)}` : ""}.
        </span>
        {result.items.length > 0 && (
          <ul className="m-0 flex list-none flex-col p-0">
            {result.items.map((i) => (
              <li
                key={`${i.label}-${i.amount}`}
                className="flex justify-between gap-3 border-t border-sand-2 py-1.5 first:border-0"
              >
                <span>{i.label}</span>
                <span className="tabular">{inr(i.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <span className="font-semibold tabular">
          Total {inr(total)}
          {result.perGuest ? " per guest" : ""}
        </span>
        {result.payments.length > 0 && (
          <span className="text-body">
            Payments:{" "}
            {result.payments
              .map((p) => `${p.label} ${inr(p.amount)}${p.date ? ` by ${shortDate(p.date)}` : ""}`)
              .join(" · ")}
          </span>
        )}
        {result.inclusions && <span className="text-body">Includes: {result.inclusions}</span>}
        {result.terms && <span className="text-body">Terms: {result.terms}</span>}
        <Field label="Budget category" htmlFor="read-cat">
          <select
            id="read-cat"
            className="field"
            value={chosen}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {ev.budget.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <span className="text-xs text-muted">
          Check the numbers against the paper before adding. Nothing is added until you choose.
        </span>
        <span className="flex flex-wrap gap-2">
          {result.kind === "bill" && (
            <button type="button" className="btn btn-primary" disabled={!total} onClick={() => add(true)}>
              Add as paid
            </button>
          )}
          <button
            type="button"
            className={`btn ${result.kind === "bill" ? "btn-secondary" : "btn-primary"}`}
            disabled={!total}
            onClick={() => add(false)}
          >
            {result.kind === "quote" ? "Add as an estimate" : "Add as to pay"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </span>
      </div>
    </Modal>
  );
}
