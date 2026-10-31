import type { ReactNode } from "react";

/** A tab's page: an eyebrow with the event name, a heading and whatever sits beside it. */
export function TabPage({
  eyebrow,
  title,
  aside,
  children,
  wide,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      id="main"
      className={`mx-auto flex ${wide ? "max-w-[1180px]" : "max-w-[960px]"} flex-col gap-6 px-4 py-8 sm:px-8`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">{eyebrow}</span>
          <h1 className="font-serif text-[40px] leading-none">{title}</h1>
        </div>
        {aside}
      </div>
      {children}
    </main>
  );
}

export function Section({
  title,
  aside,
  children,
  label,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  return (
    <section
      aria-label={label ?? title}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
    >
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="font-serif text-[24px] leading-tight">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="eyebrow text-muted">{label}</span>
      <span className={`font-serif text-[28px] leading-none tabular ${tone ?? ""}`}>{value}</span>
      {sub && <span className="text-xs text-body">{sub}</span>}
    </div>
  );
}
