import { type FormEvent, useState } from "react";
import { bindText, TextField } from "../../../components/fields";
import type { Stall } from "../../../data/communityTypes";
import { parseAmount } from "../../../lib/format";
import { newId } from "../ids";

export function StallForm({ fee, onAdd }: { fee: number; onAdd: (s: Stall) => void }) {
  const [form, setForm] = useState({
    name: "",
    owner: "",
    phone: "",
    category: "",
    fee: fee ? String(fee) : "",
  });
  const field = bindText(form, setForm);
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
      <TextField id="st-name" label="Stall name" {...field("name")} placeholder="Ammachi's pickles" />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="st-owner" label="Run by" {...field("owner")} placeholder="Flat B-204" />
        <TextField id="st-phone" label="Phone" {...field("phone")} inputMode="tel" />
        <TextField id="st-cat" label="Category" {...field("category")} placeholder="Food" />
        <TextField id="st-fee" label="Fee (₹)" {...field("fee")} inputMode="decimal" />
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
