import type { JSX, ReactNode } from "react";
import type { Person, Swatch, Tone } from "../data/baseTypes";
import { inr } from "../lib/format";
import { cssVars } from "./cssVars";

/** A horizontal progress bar. */
export function Bar({
  value,
  fill = "ink",
  label,
  className = "",
}: {
  value: number;
  fill?: Swatch | undefined;
  label?: string;
  className?: string;
}): JSX.Element {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={`bar ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <span ref={cssVars({ "--w": `${pct}%` })} className={`w-(--w) ${SWATCH_BG[fill]}`} />
    </div>
  );
}

/** The background class for each swatch. Tailwind finds classes by reading source, so each is written out whole. */
export const SWATCH_BG: Record<Swatch, string> = {
  marigold: "bg-marigold",
  indigo: "bg-indigo",
  leaf: "bg-leaf",
  maroon: "bg-maroon",
  peacock: "bg-peacock",
  rust: "bg-rust",
  kasavu: "bg-kasavu",
  ink: "bg-ink",
  "line-2": "bg-line-2",
};

/** The border colour class for each swatch. */
export const SWATCH_BORDER: Record<Swatch, string> = {
  marigold: "border-marigold",
  indigo: "border-indigo",
  leaf: "border-leaf",
  maroon: "border-maroon",
  peacock: "border-peacock",
  rust: "border-rust",
  kasavu: "border-kasavu",
  ink: "border-ink",
  "line-2": "border-line-2",
};

const TONE_TEXT: Record<Tone, string> = {
  warn: "text-rust-ink",
  due: "text-amber-ink",
  ok: "text-leaf-ink",
  idle: "text-muted",
};

/** The text colour class for a tone. */
export function toneText(t: Tone): string {
  return TONE_TEXT[t];
}

/** Jumps past the navigation to the page itself. Every screen's <main> carries id="main". */
export function SkipLink(): JSX.Element {
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
export function FundProgress({ received, expected }: { received: number; expected: number }): JSX.Element {
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

/** A small rounded label in a tone's colours. */
export function Pill({ tone, children }: { tone: Tone | "ai"; children: ReactNode }): JSX.Element {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/** A person's initials in a coloured circle. */
export function Avatar({ p, ring = true }: { p: Person; ring?: boolean }): JSX.Element {
  return (
    <span
      title={p.name}
      ref={cssVars({ "--bg": p.bg, "--fg": p.fg })}
      className={`inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-(--bg) font-semibold text-(--fg) text-[11px] ${ring ? "border-2 border-paper" : ""}`}
    >
      {p.initials}
    </span>
  );
}

// Each dot starts a beat after the one before, so the three make a wave.
const DOT_DELAYS = ["[animation-delay:0s]", "[animation-delay:0.15s]", "[animation-delay:0.3s]"];

/** Three dots in a wave while the assistant thinks; the caller labels it for screen readers. */
export function ThinkingDots(): JSX.Element {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {DOT_DELAYS.map((delay) => (
        <span
          key={delay}
          className={`h-1.5 w-1.5 animate-[wave_0.9s_ease-in-out_infinite] rounded-full bg-peacock ${delay}`}
        />
      ))}
    </span>
  );
}

/** A loading spinner, with a label for screen readers when it stands alone. */
export function Spinner({ label }: { label?: string }): JSX.Element {
  if (!label) return <span className="spinner" aria-hidden="true" />;
  return <span className="spinner" role="status" aria-label={label} />;
}

/** Each kind of event keeps its colour everywhere: marigold weddings, indigo birthdays, leaf community events. */
/** A headline number with its progress and one line of context. */
export function StatTile({
  label,
  value,
  sub,
  bar,
  fill,
}: {
  label: string;
  value: string;
  sub: string;
  bar: number;
  fill?: Swatch;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <span className="eyebrow text-muted">{label}</span>
      <span className="tabular font-serif text-[32px] leading-none">{value}</span>
      <Bar value={bar} fill={fill} label={label} />
      <span className="text-body text-xs leading-[1.4]">{sub}</span>
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
}): JSX.Element {
  return (
    <section
      id={id}
      className="flex scroll-mt-4 flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[24px] leading-none">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
