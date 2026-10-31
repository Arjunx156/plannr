import type { ReactNode } from "react";
import { Field } from "../../components/fields";

/**
 * The "What for" and "Amount (₹)" fields every money form starts with. `beside` sits next to
 * the amount (a due date, who paid); ids are prefixed with `id` so two forms can share a page.
 */
export function WhatForAmount({
  id,
  label,
  amount,
  placeholder,
  onChange,
  beside,
}: {
  id: string;
  label: string;
  amount: string;
  placeholder: string;
  onChange: (patch: { label?: string; amount?: string }) => void;
  beside: ReactNode;
}) {
  return (
    <>
      <Field label="What for" htmlFor={`${id}-label`}>
        <input
          id={`${id}-label`}
          className="field"
          value={label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={placeholder}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)" htmlFor={`${id}-amount`}>
          <input
            id={`${id}-amount`}
            className="field"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
        </Field>
        {beside}
      </div>
    </>
  );
}

/** Picks a budget category; `none` names the empty choice ("None", "The vendor's category"). */
export function CategorySelect({
  id,
  categories,
  value,
  onChange,
  none = "None",
  hint,
}: {
  id: string;
  categories: { id: string; name: string }[];
  value: string;
  onChange: (categoryId: string) => void;
  none?: string;
  hint?: string;
}) {
  return (
    <Field label="Budget category" htmlFor={id} hint={hint}>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{none}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
