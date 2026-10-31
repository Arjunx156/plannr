import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

export function Logo({
  size = 26,
  tone = "ink",
  to,
}: {
  size?: number;
  tone?: "ink" | "light";
  to?: string;
}) {
  const body = (
    <span className="inline-flex items-center gap-2">
      <span
        className={`font-serif italic leading-none ${tone === "light" ? "text-white" : "text-ink"}`}
        style={{ fontSize: size, letterSpacing: "-0.01em" }}
      >
        Plannr
      </span>
      <span
        aria-hidden="true"
        className="rounded-full bg-marigold"
        style={{ width: size > 28 ? 8 : 7, height: size > 28 ? 8 : 7, marginTop: size > 28 ? 10 : 8 }}
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
}) {
  return <div aria-hidden="true" className={`${TORAN_CLASS[size]} ${className}`} />;
}

export function Kolam({ className = "kolam", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} style={style} />
  );
}

/** The raised paper card a CardPage holds; pages add their own width, gap and padding. */
export const PAPER_CARD =
  "flex w-full flex-col rounded-xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,.06),0_16px_48px_rgba(60,40,20,.10)]";

/** A quiet page with only the logo and one card in the middle, for joining a plan and first-run setup. */
export function CardPage({ children }: { children: ReactNode }) {
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
