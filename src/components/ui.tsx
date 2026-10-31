import type { ReactNode } from "react";
import type { Hue, Person, Tone } from "../data/baseTypes";
import { inr } from "../lib/format";

export function Bar({
  value,
  color = "var(--color-ink)",
  height = 6,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="bar"
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-rust-ink",
  due: "text-amber-ink",
  ok: "text-leaf-ink",
  idle: "text-muted",
};

export function toneText(t: Tone): string {
  return TONE_TEXT[t];
}

/** Jumps past the navigation to the page itself. Every screen's <main> carries id="main". */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>
  );
}

/** "₹40,000 / ₹60,000": money in against money expected. */
export function FundProgress({ received, expected }: { received: number; expected: number }) {
  return (
    <span className="tabular">
      {inr(received)} <span className="text-muted">/ {inr(expected)}</span>
    </span>
  );
}

/** Notice card styling by tone: AI suggestions glow, warnings get a rust edge. */
export const NOTICE_CARD: Record<"ai" | "warn" | "info", string> = {
  ai: "card-ai",
  warn: "border-rust-line bg-surface",
  info: "border-line bg-surface",
};

export function Pill({ tone, children }: { tone: Tone | "ai"; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Avatar({ p, size = 30, ring = true }: { p: Person; size?: number; ring?: boolean }) {
  return (
    <span
      title={p.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: p.bg,
        color: p.fg,
        fontSize: size > 32 ? 13 : 11,
        border: ring ? "2px solid var(--color-paper)" : undefined,
      }}
    >
      {p.initials}
    </span>
  );
}

/** Three dots in a wave while the assistant thinks; the caller labels it for screen readers. */
export function ThinkingDots() {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-peacock"
          style={{ animation: `wave 0.9s ease-in-out ${d * 0.15}s infinite` }}
        />
      ))}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  if (!label) return <span className="spinner" aria-hidden="true" />;
  return <span className="spinner" role="status" aria-label={label} />;
}

/** Each kind of event keeps its colour everywhere: marigold weddings, indigo birthdays, leaf community events. */
export const HUE_COLOR: Record<Hue, string> = {
  marigold: "var(--color-marigold)",
  indigo: "var(--color-indigo)",
  leaf: "var(--color-leaf)",
  maroon: "var(--color-maroon)",
};

/** A headline number with its progress and one line of context. */
export function StatTile({
  label,
  value,
  sub,
  bar,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  bar: number;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <span className="eyebrow text-muted">{label}</span>
      <span className="font-serif text-[32px] leading-none tabular">{value}</span>
      <Bar value={bar} color={color} label={label} />
      <span className="text-xs leading-[1.4] text-body">{sub}</span>
    </div>
  );
}

/** A titled section of a screen, with an optional control on the right. */
export function Panel({
  title,
  aside,
  children,
  id,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5 scroll-mt-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[24px] leading-none">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
