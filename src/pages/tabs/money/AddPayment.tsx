import { type FormEvent, useState } from "react";
import { bindText, Field, TextField } from "../../../components/fields";
import type { Payment } from "../../../data/budgetTypes";
import type { PersonalEvent } from "../../../data/types";
import { addDays, TODAY } from "../../../lib/dates";
import { inr, parseAmount } from "../../../lib/format";
import { list } from "../../../shared/records";
import { useStore } from "../../../store/store";
import { CategorySelect, WhatForAmount } from "../amounts";
import { newId } from "../ids";

export function AddPayment({ ev, onDone }: { ev: PersonalEvent; onDone: () => void }) {
  const { dispatch } = useStore();
  const vendors = list(ev, "vendors").filter((v) => v.name);
  const [form, setForm] = useState({
    label: "",
    amount: "",
    date: addDays(TODAY, 14),
    vendorId: "",
    categoryId: "",
  });
  const field = bindText(form, setForm);
  const amount = parseAmount(form.amount);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !amount) return;
    const v = vendors.find((x) => x.id === form.vendorId);
    const record: Payment = {
      id: newId("pay"),
      label: form.label.trim(),
      amount,
      date: form.date,
      paid: false,
      ...(form.vendorId ? { vendorId: form.vendorId } : {}),
      ...(form.categoryId || v?.categoryId ? { categoryId: form.categoryId || v?.categoryId } : {}),
    };
    dispatch({ type: "addRecord", eventId: ev.id, coll: "payments", record });
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <WhatForAmount
        id="pay"
        label={form.label}
        amount={form.amount}
        placeholder="Florist advance"
        onChange={(patch) => setForm({ ...form, ...patch })}
        beside={<TextField id="pay-date" label="Due" {...field("date")} type="date" />}
      />
      <Field label="Vendor" htmlFor="pay-vendor">
        <select
          id="pay-vendor"
          className="field"
          value={form.vendorId}
          onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
        >
          <option value="">None</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.category})
            </option>
          ))}
        </select>
      </Field>
      <CategorySelect
        id="pay-cat"
        categories={ev.budget.categories}
        {...field("categoryId")}
        none={form.vendorId ? "The vendor's category" : "None"}
        hint="Marking it paid adds it to this category's spending."
      />
      <button type="submit" className="btn btn-primary self-start" disabled={!form.label.trim() || !amount}>
        Schedule {amount ? inr(amount) : ""}
      </button>
    </form>
  );
}
