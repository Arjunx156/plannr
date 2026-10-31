import { type FormEvent, type JSX, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Kolam, Logo, Toran } from "../../components/brand";
import { Pill } from "../../components/ui";
import { DRAFT_BARS, EXAMPLE, NAV, OCCASIONS } from "./content";
import { PAD } from "./layout";

const NAV_LINK = "text-cream no-underline hover:text-white hover:underline underline-offset-4";
const MENU_LINK = "rounded-lg px-2 py-3 text-[17px] font-medium text-cream no-underline hover:bg-white/10";

/** The top bar: a link to each section on wide screens, a menu on narrow ones. */
function TopNav({ signedIn }: { signedIn: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const account = signedIn ? { to: "/events", label: "My events" } : { to: "/signin", label: "Log in" };
  return (
    <>
      <nav aria-label="Main" className={`relative flex items-center gap-8 py-5 ${PAD}`}>
        <Logo size={32} tone="light" to="/" />
        <ul className="ml-6 hidden gap-7 font-medium text-[15px] lg:flex">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className={NAV_LINK}>
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex-1" />
        <Link
          to={account.to}
          className="hidden font-medium text-[15px] text-cream no-underline hover:text-white sm:inline"
        >
          {account.label}
        </Link>
        <Link to="/new" className="btn btn-gold btn-lg hidden sm:inline-flex">
          Start planning
        </Link>
        <button
          type="button"
          className="btn btn-ghost text-cream hover:bg-white/10 hover:text-white lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
      </nav>
      {menuOpen && (
        <div id="mobile-nav" className={`relative flex flex-col gap-1 pb-6 lg:hidden ${PAD}`}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className={MENU_LINK}>
              {n.label}
            </a>
          ))}
          <Link to={account.to} className={MENU_LINK}>
            {account.label}
          </Link>
        </div>
      )}
    </>
  );
}

/** One sentence in, and straight to the drafting conversation with it. */
function PromptForm() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const start = (e: FormEvent) => {
    e.preventDefault();
    void navigate("/new", { state: { prompt: prompt.trim() || EXAMPLE } });
  };
  return (
    <form
      onSubmit={start}
      className="focus-frame flex max-w-[620px] flex-col gap-3 rounded-2xl bg-surface p-3 text-ink shadow-[0_20px_40px_rgba(20,5,10,.25)] sm:flex-row sm:items-center sm:pl-5"
    >
      <label htmlFor="hero-prompt" className="sr-only">
        Describe your event
      </label>
      <input
        id="hero-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={EXAMPLE}
        className="min-h-12 flex-1 rounded-lg bg-transparent px-2 text-[17px] text-ink outline-none placeholder:text-body focus-visible:outline-none sm:px-0"
        autoComplete="off"
      />
      <button type="submit" className="btn btn-primary btn-lg rounded-[11px]">
        Start planning
      </button>
    </form>
  );
}

/** What a drafted plan looks like: the sample wedding's split, and a warning it would raise. */
function DraftPreview() {
  return (
    <div className="relative lg:h-[520px]" role="img" aria-label="A plan Plannr drafted from that sentence">
      <div className="flex flex-col gap-3.5 rounded-[18px] bg-paper p-[22px] text-ink shadow-[0_30px_60px_rgba(20,5,10,.35)] lg:absolute lg:top-0 lg:right-0 lg:w-[470px]">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-peacock">◆ Drafted from one sentence</span>
          <span className="eyebrow text-muted">Kochi · Dec</span>
        </div>
        <span className="font-serif text-[28px] leading-[1.1]">Kerala wedding, 250 guests</span>
        <div className="flex flex-col gap-[7px]">
          {DRAFT_BARS.map((b) => (
            <div
              key={b.name}
              className="grid grid-cols-[96px_minmax(0,1fr)_84px] items-center gap-2.5 text-[13px] sm:grid-cols-[110px_minmax(0,1fr)_84px]"
            >
              <span>{b.name}</span>
              <div className={`h-2 rounded-[2px] ${b.bar}`} />
              <span className="tabular text-right">{b.amount}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 font-medium text-body text-xs">
          {["71 tasks", "11 vendors", "4 guest groups"].map((x) => (
            <span key={x} className="rounded-full bg-sand-2 px-2.5 py-1.5">
              {x}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-surface p-[18px] text-ink shadow-[0_24px_50px_rgba(20,5,10,.35)] lg:absolute lg:bottom-[30px] lg:left-0 lg:mt-0 lg:w-[360px]">
        <Pill tone="warn">Over plan</Pill>
        <span className="font-medium text-[15px] leading-[1.4]">
          Catering is heading for ₹5,04,000 against ₹4,50,000 planned, 12% over.
        </span>
        <span className="text-peacock text-xs leading-[1.4]">
          From the caterer's quote: ₹2,016 a plate for 250 guests.
        </span>
      </div>
    </div>
  );
}

/** The maroon header: navigation, the one-sentence prompt, and a drafted plan beside it. */
export function Hero({
  signedIn,
  demoMode,
  onDemo,
}: {
  signedIn: boolean;
  demoMode: boolean;
  onDemo: () => void;
}): JSX.Element {
  return (
    <header className="on-dark relative overflow-hidden bg-maroon text-cream">
      <Kolam className="kolam-hero" />
      <Toran size="lg" className="relative" />
      <TopNav signedIn={signedIn} />
      <div
        id="main"
        className={`relative grid items-center gap-16 pt-10 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16 lg:pb-24 ${PAD}`}
      >
        <div className="flex flex-col gap-7">
          <span className="eyebrow text-[12px] text-gold-soft tracking-[0.1em]">
            Weddings · Birthdays · Community events
          </span>
          <h1 className="font-serif text-[clamp(44px,6.2vw,80px)] text-white leading-none tracking-[-0.025em] [text-wrap:balance]">
            Describe your event. Get a plan you can <i className="text-gold-soft">actually run.</i>
          </h1>
          <p className="max-w-[560px] text-[clamp(17px,1.5vw,19px)] leading-[1.55] [text-wrap:pretty]">
            For weddings, birthdays and community events: one conversation gives you a budget, a timeline, a
            vendor checklist and personalised ideas, all kept in sync. Plannr drafts; you approve every
            change.
          </p>
          <PromptForm />
          {demoMode && (
            <button
              type="button"
              onClick={onDemo}
              className="self-start font-semibold text-[15px] text-gold-soft underline-offset-4 hover:text-white hover:underline"
            >
              Or try the demo with sample events →
            </button>
          )}
          <div className="flex flex-col gap-2.5">
            <span className="text-gold-soft text-sm">Or start with</span>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Link
                  key={o.type}
                  to={`/new?type=${o.type}`}
                  className="inline-flex min-h-10 items-center rounded-3xl border border-[rgba(241,217,166,.5)] px-4 font-semibold text-[15px] text-cream no-underline hover:border-gold-soft hover:bg-white/10 hover:text-white"
                >
                  {o.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <DraftPreview />
      </div>
    </header>
  );
}
