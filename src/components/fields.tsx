import type { InputHTMLAttributes, JSX, ReactNode } from "react";

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
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {typeof hint === "string" ? <span className="text-muted text-xs leading-[1.4]">{hint}</span> : hint}
    </div>
  );
}

type TextKey<F> = { [K in keyof F]: F[K] extends string ? K : never }[keyof F];

/** What a text field needs from the form it edits. */
export interface TextBinding {
  value: string;
  onChange: (value: string) => void;
}

/** Ties text fields to a form kept in state: `<TextField id="name" label="Name" {...field("name")} />`. */
export function bindText<F>(form: F, setForm: (next: F) => void): (key: TextKey<F>) => TextBinding {
  return (key) => ({
    value: String(form[key]),
    onChange: (value: string): void => setForm({ ...form, [key]: value }),
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
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange" | "className">): JSX.Element {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...input} />
    </Field>
  );
}
