import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo, Toran, usePageMeta } from "../../components/ui";

/** The public pages' frame: guides, tools, pricing and the legal pages. */
export function SitePage({
  title,
  description,
  eyebrow,
  heading,
  lead,
  children,
  wide,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  heading: string;
  lead?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  usePageMeta(title, { description });
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="border-b border-line bg-surface">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8"
        >
          <Logo to="/" />
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <Link to="/how-it-works" className="link text-body">
              How it works
            </Link>
            <Link to="/tools" className="link text-body">
              Free tools
            </Link>
            <Link to="/pricing" className="link text-body">
              Pricing
            </Link>
            <Link to="/new" className="btn btn-primary btn-sm">
              Start planning
            </Link>
          </span>
        </nav>
      </header>
      <main
        className={`mx-auto flex w-full ${wide ? "max-w-[1180px]" : "max-w-[860px]"} flex-1 flex-col gap-8 px-4 py-10 sm:px-8`}
      >
        <div className="flex flex-col gap-3">
          {eyebrow && <span className="eyebrow text-amber-ink">{eyebrow}</span>}
          <h1 className="font-serif text-[clamp(36px,5vw,52px)] leading-[1.05] tracking-[-0.015em]">
            {heading}
          </h1>
          {lead && <p className="m-0 max-w-[680px] text-[18px] leading-[1.55] text-body">{lead}</p>}
        </div>
        {children}
      </main>
      <footer className="on-dark relative bg-ink pt-10 pb-8 text-stone">
        <Toran size="beads" className="absolute inset-x-0 top-0" />
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 sm:px-8">
          <div className="grid gap-6 text-sm leading-[1.9] sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Logo size={24} tone="light" />
              <span className="text-line-2">Made in Kochi.</span>
            </div>
            <FooterLinks
              title="Plan a"
              links={[
                ["/weddings", "Wedding"],
                ["/birthdays", "Birthday"],
                ["/community", "Community event"],
              ]}
            />
            <FooterLinks
              title="Free tools"
              links={[
                ["/tools/budget-calculator", "Budget splitter"],
                ["/tools/kerala-wedding-checklist", "Kerala wedding checklist"],
                ["/tools/shagun-register", "Gift and shagun register"],
                ["/tools/festival-checklist", "Festival committee checklist"],
              ]}
            />
            <FooterLinks
              title="Plannr"
              links={[
                ["/how-it-works", "How it works"],
                ["/pricing", "Pricing"],
                ["/privacy", "Privacy"],
                ["/terms", "Terms"],
              ]}
            />
          </div>
          <p className="m-0 text-[13px] text-line-2">© 2026 Plannr</p>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-white">{title}</span>
      {links.map(([to, label]) => (
        <Link
          key={to}
          to={to}
          className="text-stone no-underline underline-offset-4 hover:text-white hover:underline"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

/** A block of prose on a public page. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-[720px] flex-col gap-4 text-[16px] leading-[1.65] text-body [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-[28px] [&_h2]:leading-tight [&_h2]:text-ink [&_li]:ml-5 [&_ul]:m-0 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:p-0">
      {children}
    </div>
  );
}

export function CallToAction({
  prompt,
  label = "Plan yours with Plannr",
}: {
  prompt?: string;
  label?: string;
}) {
  return (
    <section
      aria-label="Start planning"
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-6 text-paper"
    >
      <span className="max-w-[520px] font-serif text-[26px] leading-tight text-white">
        Describe the day in one sentence and get a plan you can run.
      </span>
      <span className="flex flex-wrap gap-2">
        <Link to="/new" state={prompt ? { prompt } : undefined} className="btn btn-gold">
          {label}
        </Link>
        <Link to="/signin?next=/events" className="btn btn-outline border-line-2 text-paper">
          Try the demo
        </Link>
      </span>
    </section>
  );
}
