import type { JSX, ReactNode } from "react";
import { Link } from "react-router";

/** The sizes the wordmark comes in, in pixels. */
type LogoSize = 24 | 26 | 28 | 30 | 32;

const LOGO_TEXT: Record<LogoSize, string> = {
  24: "text-[24px]",
  26: "text-[26px]",
  28: "text-[28px]",
  30: "text-[30px]",
  32: "text-[32px]",
};

/** Plannr's wordmark, in ink or on a dark ground. */
export function Logo({
  size = 26,
  tone = "ink",
  to,
}: {
  size?: LogoSize;
  tone?: "ink" | "light";
  to?: string;
}): JSX.Element {
  const body = (
    <span className="inline-flex items-center gap-2">
      <span
        className={`font-serif italic leading-none tracking-[-0.01em] ${LOGO_TEXT[size]} ${tone === "light" ? "text-white" : "text-ink"}`}
      >
        Plannr
      </span>
      <span
        aria-hidden="true"
        className={`rounded-full bg-marigold ${size > 28 ? "mt-[10px] h-2 w-2" : "mt-2 h-[7px] w-[7px]"}`}
      />
    </span>
  );
  if (!to) return body;
  return (
    <Link to={to} aria-label="Plannr home" className="no-underline">
      {body}
    </Link>
  );
}

const TORAN_CLASS = { sm: "toran", md: "toran-md", lg: "toran-lg", beads: "toran-beads" } as const;

/** The marigold garland that tops a card; purely decorative. */
export function Toran({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "beads";
  className?: string;
}): JSX.Element {
  return <div aria-hidden="true" className={`${TORAN_CLASS[size]} ${className}`} />;
}

/** The kolam pattern used as quiet decoration on cards and empty states. */
export function Kolam({ className = "kolam" }: { className?: string }): JSX.Element {
  return <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />;
}

/** The raised paper card a CardPage holds; pages add their own width, gap and padding. */
export const PAPER_CARD =
  "flex w-full flex-col rounded-xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,.06),0_16px_48px_rgba(60,40,20,.10)]";

/** A quiet page with only the logo and one card in the middle, for joining a plan and first-run setup. */
export function CardPage({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col bg-sand">
      <Toran />
      <div className="flex items-center px-5 py-4 sm:px-10">
        <Logo to="/" />
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center">
        {children}
      </main>
    </div>
  );
}
