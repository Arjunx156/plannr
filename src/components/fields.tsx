import type { InputHTMLAttributes, ReactNode } from "react";

/** A label over any control, with an optional hint under it. */
export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {typeof hint === "string" ? <span className="text-xs leading-[1.4] text-muted">{hint}</span> : hint}
    </div>
  );
}

type TextKey<F> = { [K in keyof F]: F[K] extends string ? K : never }[keyof F];

/** Ties text fields to a form kept in state: `<TextField id="name" label="Name" {...field("name")} />`. */
export function bindText<F>(form: F, setForm: (next: F) => void) {
  return (key: TextKey<F>) => ({
    value: form[key] as string,
    onChange: (value: string) => setForm({ ...form, [key]: value }),
  });
}

/** A labelled text input. Other input attributes (type, inputMode, placeholder…) pass through. */
export function TextField({
  id,
  label,
  value,
  onChange,
  hint,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "className">) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...input} />
    </Field>
  );
}
