import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Kolam, Logo, Pill, SkipLink, Toran, usePageMeta } from "../components/ui";
import { useStore } from "../store/store";
import {
  DRAFT_BARS,
  EXAMPLE,
  EXAMPLES,
  FAQS,
  FEATURES,
  NAV,
  OCCASIONS,
  SAMPLE_EVENT,
  SAMPLES,
  type SampleId,
  STEPS,
} from "./landing/content";

const PAD = "px-5 sm:px-10 lg:px-[72px]";
const H2 = "font-serif text-[clamp(34px,4.6vw,48px)] leading-[1.05] tracking-[-0.015em]";

/** The three "how it works" columns: rules between them on wide screens. */
const STEP_COLUMN = ["md:pr-7", "border-line md:border-l md:px-7", "border-line md:border-l md:pl-7"];

export function Landing() {
  usePageMeta("Plannr");
  const navigate = useNavigate();
  const { state, dispatch } = useStore();
  const [prompt, setPrompt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sample, setSample] = useState<SampleId>("wedding");
  const s = SAMPLES[sample];

  const start = (e: FormEvent) => {
    e.preventDefault();
    navigate("/new", { state: { prompt: prompt.trim() || EXAMPLE } });
  };

  /** Opens the sample events in this browser, without an account. */
  const demo = (to = "/events") => {
    if (state.mode !== "demo" || !state.session.signedIn) dispatch({ type: "enterDemo" });
    navigate(to);
  };
  const signedIn = state.session.signedIn;

  return (
    <div className="bg-paper text-ink">
      <SkipLink />
      <header className="on-dark relative overflow-hidden bg-maroon text-cream">
        <Kolam
          className="kolam"
          style={{
            background: "radial-gradient(rgba(217,150,43,.30) 1.4px,transparent 1.7px) 0 0/20px 20px",
          }}
        />
        <Toran size="lg" className="relative" />
        <nav aria-label="Main" className={`relative flex items-center gap-8 py-5 ${PAD}`}>
          <Logo size={32} tone="light" to="/" />
          <ul className="ml-6 hidden gap-7 text-[15px] font-medium lg:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="text-cream no-underline hover:text-white hover:underline underline-offset-4"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex-1" />
          <Link
            to={signedIn ? "/events" : "/signin"}
            className="hidden text-[15px] font-medium text-cream no-underline hover:text-white sm:inline"
          >
            {signedIn ? "My events" : "Log in"}
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
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 text-[17px] font-medium text-cream no-underline hover:bg-white/10"
              >
                {n.label}
              </a>
            ))}
            <Link
              to={signedIn ? "/events" : "/signin"}
              className="rounded-lg px-2 py-3 text-[17px] font-medium text-cream no-underline hover:bg-white/10"
            >
              {signedIn ? "My events" : "Log in"}
            </Link>
          </div>
        )}

        <div
          id="main"
          className={`relative grid items-center gap-16 pt-10 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-16 lg:pb-24 ${PAD}`}
        >
          <div className="flex flex-col gap-7">
            <span className="eyebrow tracking-[0.1em] text-[12px] text-gold-soft">
              Weddings · Birthdays · Community events
            </span>
            <h1 className="font-serif text-[clamp(44px,6.2vw,80px)] leading-none tracking-[-0.025em] text-white [text-wrap:balance]">
              Describe your event. Get a plan you can <i className="text-gold-soft">actually run.</i>
            </h1>
            <p className="max-w-[560px] text-[clamp(17px,1.5vw,19px)] leading-[1.55] [text-wrap:pretty]">
              For weddings, birthdays and community events: one conversation gives you a budget, a timeline, a
              vendor checklist and personalised ideas, all kept in sync. Plannr drafts; you approve every
              change.
            </p>
            <form
              onSubmit={start}
              className="flex max-w-[620px] flex-col gap-3 rounded-2xl bg-surface p-3 text-ink shadow-[0_20px_40px_rgba(20,5,10,.25)] sm:flex-row sm:items-center sm:pl-5"
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
            {state.mode === "demo" && (
              <button
                type="button"
                onClick={() => demo()}
                className="self-start text-[15px] font-semibold text-gold-soft underline-offset-4 hover:text-white hover:underline"
              >
                Or try the demo with sample events →
              </button>
            )}
            <div className="flex flex-col gap-2.5">
              <span className="text-sm text-gold-soft">Or start with</span>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((o) => (
                  <Link
                    key={o.type}
                    to={`/new?type=${o.type}`}
                    className="inline-flex min-h-10 items-center rounded-3xl border border-[rgba(241,217,166,.5)] px-4 text-[15px] font-semibold text-cream no-underline hover:border-gold-soft hover:bg-white/10 hover:text-white"
                  >
                    {o.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div
            className="relative lg:h-[520px]"
            role="img"
            aria-label="A plan Plannr drafted from that sentence"
          >
            <div className="flex flex-col gap-3.5 rounded-[18px] bg-paper p-[22px] text-ink shadow-[0_30px_60px_rgba(20,5,10,.35)] lg:absolute lg:top-0 lg:right-0 lg:w-[470px]">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-peacock">◆ Drafted in 18 seconds</span>
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
                    <div
                      className="h-2 rounded-[2px]"
                      style={{ width: `${b.width}%`, background: b.color }}
                    />
                    <span className="tabular text-right">{b.amount}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-body">
                {["71 tasks", "11 vendors", "4 guest groups"].map((x) => (
                  <span key={x} className="rounded-full bg-sand-2 px-2.5 py-1.5">
                    {x}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-surface p-[18px] text-ink shadow-[0_24px_50px_rgba(20,5,10,.35)] lg:absolute lg:bottom-[30px] lg:left-0 lg:mt-0 lg:w-[360px]">
              <Pill tone="warn">Over plan</Pill>
              <span className="text-[15px] leading-[1.4] font-medium">
                Catering is heading for ₹5,04,000 against ₹4,50,000 planned, 12% over.
              </span>
              <span className="text-xs leading-[1.4] text-peacock">
                From the caterer's quote: ₹2,016 a plate for 250 guests.
              </span>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="occasions" className={`flex scroll-mt-4 flex-col gap-8 pt-[88px] pb-10 ${PAD}`}>
          <h2 className={`${H2} max-w-[760px]`}>Every kind of occasion gets its own kind of plan</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {OCCASIONS.map((o) => (
              <Link
                key={o.type}
                to={`/new?type=${o.type}`}
                className={`group flex flex-col overflow-hidden rounded-2xl bg-surface text-ink no-underline transition-shadow hover:shadow-[0_12px_32px_rgba(60,40,20,.10)] ${o.dashed ? "border border-dashed border-line-2" : "border border-line"}`}
              >
                <div className="h-2" style={{ background: o.bar }} />
                <div className="flex flex-1 flex-col gap-3 p-6">
                  <span className="font-serif text-[30px] leading-none group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {o.name}
                  </span>
                  <span className="text-[15px] leading-[1.5] text-body">{o.body}</span>
                  <span className={`mt-auto pt-1.5 font-mono text-xs font-medium uppercase ${o.ink}`}>
                    {o.span}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="how"
          className={`grid scroll-mt-4 gap-10 py-14 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16 ${PAD}`}
        >
          <div className="flex flex-col gap-3.5">
            <span className="eyebrow text-[12px] tracking-[0.1em] text-amber-ink">How it works</span>
            <h2 className={H2}>Three steps from idea to the day</h2>
          </div>
          <ol className="m-0 grid list-none border-t-2 border-ink p-0 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className={`flex flex-col gap-3 pt-6 pb-4 md:pb-0 ${STEP_COLUMN[Math.min(i, STEP_COLUMN.length - 1)]} ${i > 0 ? "border-t md:border-t-0" : ""}`}
              >
                <span className="font-serif text-[64px] leading-none text-marigold italic">{i + 1}</span>
                <span className="text-[19px] leading-[1.3] font-semibold">{step.title}</span>
                <span className="text-[15px] leading-[1.55] text-body">{step.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className={`flex scroll-mt-4 flex-col gap-8 py-14 ${PAD}`}>
          <h2 className={H2}>Everything connected, so one change updates the rest</h2>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="flex min-h-[190px] flex-col gap-2.5 bg-paper p-7">
                <span aria-hidden="true" className="h-3 w-3 rotate-45" style={{ background: f.c }} />
                <h3 className="mt-1.5 font-serif text-[26px] leading-[1.1]">{f.t}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-body">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="sample"
          className="relative mx-5 my-10 flex flex-col gap-7 overflow-hidden rounded-3xl bg-sand p-6 sm:mx-10 sm:p-12 lg:mx-[72px]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1.5 border-b-2 border-kasavu"
            style={{ background: "linear-gradient(#D6B15E,#D6B15E) 0 0/100% 2px no-repeat" }}
          />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-3">
              <span className="eyebrow text-[12px] tracking-[0.1em] text-amber-ink">
                Sample plan · no sign-up needed
              </span>
              <h2 className={H2}>See what one sentence produces</h2>
            </div>
            <div
              role="tablist"
              aria-label="Sample plans"
              className="flex self-start overflow-x-auto rounded-xl bg-stone p-1 text-sm font-semibold"
            >
              {(Object.keys(SAMPLES) as SampleId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={sample === id}
                  aria-controls="sample-panel"
                  onClick={() => setSample(id)}
                  className={`min-h-10 rounded-[9px] px-4 whitespace-nowrap ${sample === id ? "bg-surface text-ink" : "text-body hover:text-ink"}`}
                >
                  {SAMPLES[id].tab}
                </button>
              ))}
            </div>
          </div>
          <div
            id="sample-panel"
            role="tabpanel"
            aria-labelledby={`tab-${sample}`}
            className="grid gap-4 lg:grid-cols-3"
          >
            <div className="flex flex-col gap-3 rounded-[14px] bg-surface p-[22px]">
              <span className="eyebrow text-muted">The prompt</span>
              <span className="font-serif text-[22px] leading-[1.35] italic">“{s.prompt}”</span>
              <span className="eyebrow mt-2 text-muted">Plannr asked</span>
              <span className="text-sm leading-normal text-body">{s.asked}</span>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface p-[22px]">
              <span className="eyebrow text-muted">First 5 tasks</span>
              <ul className="m-0 flex list-none flex-col p-0 text-sm leading-[1.3]">
                {s.tasks.map((t, i) => (
                  <li
                    key={t.t}
                    className={`flex justify-between gap-2.5 py-[9px] ${i < s.tasks.length - 1 ? "border-b border-sand-2" : ""}`}
                  >
                    <span>{t.t}</span>
                    <span className={`flex-none ${t.urgent ? "font-semibold text-rust-ink" : "text-muted"}`}>
                      {t.when}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface p-[22px]">
              <span className="eyebrow text-muted">Vendors it knew to add</span>
              <div className="flex flex-wrap gap-1.5 text-[13px] font-medium">
                {s.vendors.map((v) => (
                  <span key={v} className="rounded-full bg-sand px-2.5 py-[7px]">
                    {v}
                  </span>
                ))}
              </div>
              <p className="m-0 mt-auto rounded-[10px] bg-peacock-tint p-3 text-[13px] leading-[1.45] text-peacock">
                ◆ {s.why}
              </p>
            </div>
          </div>
          {state.mode === "demo" ? (
            <button
              type="button"
              className="btn btn-primary btn-lg self-start"
              onClick={() => demo(`/events/${SAMPLE_EVENT[sample]}`)}
            >
              Open the full sample plan
            </button>
          ) : (
            <Link to="/new" className="btn btn-primary btn-lg self-start">
              Plan yours like this
            </Link>
          )}
        </section>

        <section className={`flex flex-col gap-8 py-[72px] ${PAD}`} aria-labelledby="examples">
          <h2 id="examples" className={H2}>
            Built for days like these
          </h2>
          <div className="grid gap-8 md:grid-cols-3 md:gap-5">
            {EXAMPLES.map((t) => (
              <article
                key={t.title}
                className="m-0 flex flex-col gap-3 border-t-2 pt-5"
                style={{ borderColor: t.color }}
              >
                <h3 className="font-serif text-[24px] leading-[1.2]">{t.title}</h3>
                <p className="m-0 text-[16px] leading-[1.5] text-body">{t.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className={`grid scroll-mt-4 items-stretch gap-5 pt-6 pb-[72px] md:grid-cols-2 xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)] ${PAD}`}
        >
          <div className="flex flex-col gap-3.5 md:col-span-2 xl:col-span-1">
            <span className="eyebrow text-[12px] tracking-[0.1em] text-amber-ink">Pricing</span>
            <h2 className={H2}>Free while Plannr is new.</h2>
          </div>
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-[18px] bg-ink p-7 text-paper">
            <Toran size="beads" className="absolute inset-x-0 top-0" />
            <div className="mt-2 flex items-baseline justify-between font-serif text-[30px] leading-none">
              <h3>Early access</h3>
              <span>₹0</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-[9px] p-0 text-[15px] leading-[1.4] text-stone">
              <li>Every feature, for every event and guest</li>
              <li>AI planning, drafting and receipt reading, within a fair daily limit</li>
              <li>RSVP pages, event website, vendor call sheets and helper links</li>
              <li>Co-planners with roles, history and undo</li>
              <li>Works offline on the day, with a morning reminder</li>
            </ul>
            <Link to="/new" className="btn btn-gold btn-lg mt-auto">
              Start planning
            </Link>
          </div>
          <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface p-7">
            <h3 className="font-serif text-[30px] leading-none">Later</h3>
            <p className="m-0 text-[15px] leading-[1.5] text-body">
              Plannr will stay free for small events. For big weddings we plan a one-time Celebration Pass,
              and for associations and committees a Community plan.
            </p>
            <p className="m-0 text-[15px] leading-[1.5] text-body">
              Nothing is charged today, and nothing will be without asking you first. Any event you start
              during early access stays free to finish.
            </p>
          </div>
        </section>

        <section
          id="faq"
          className={`grid scroll-mt-4 gap-8 pt-6 pb-[88px] lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16 ${PAD}`}
        >
          <h2 className={H2}>Questions</h2>
          <div className="flex flex-col border-t border-line-2">
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0} className="group border-b border-line-2">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-[22px] text-lg leading-[1.3] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <span aria-hidden="true" className="w-4 shrink-0 text-center">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="m-0 max-w-[760px] pb-[22px] text-base leading-[1.6] text-body">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="on-dark relative flex flex-col gap-12 overflow-hidden bg-ink pt-16 pb-10 text-stone">
        <Toran size="lg" className="absolute inset-x-0 top-0" />
        <div className={`flex flex-col justify-between gap-8 sm:flex-row sm:items-end ${PAD}`}>
          <p className="m-0 max-w-[640px] font-serif text-[clamp(40px,5vw,56px)] leading-[1.05] text-white">
            What are you celebrating?
          </p>
          <Link to="/new" className="btn btn-gold btn-lg self-start sm:self-auto">
            Start planning
          </Link>
        </div>
        <div className={`flex flex-col gap-8`}>
          <div
            className={`mx-5 grid gap-8 border-t border-[#3A332B] pt-8 text-sm leading-[1.9] sm:mx-10 sm:grid-cols-2 lg:mx-[72px] lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]`}
          >
            <div className="flex flex-col gap-2">
              <Logo size={28} tone="light" />
              <span className="text-line-2">
                Made in Kochi. Guest pages in English, Malayalam, Hindi and Tamil.
              </span>
            </div>
            <FooterCol
              title="Product"
              links={[
                ["/how-it-works", "How it works"],
                ["#occasions", "Templates"],
                ["#pricing", "Pricing"],
              ]}
            />
            <FooterCol
              title="Plan a"
              links={[
                ["/weddings", "Wedding"],
                ["/birthdays", "Birthday"],
                ["/community", "Community event"],
                ["/tools", "Free tools"],
              ]}
            />
            <FooterCol
              title="Plannr"
              links={[
                ["/privacy", "Privacy"],
                ["/terms", "Terms"],
                ["/signin", "Sign in or try the demo"],
              ]}
            />
          </div>
          <p className={`m-0 text-[13px] text-line-2 ${PAD}`}>© 2026 Plannr · Engineered by Arjun Krishnan</p>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-white">{title}</span>
      {links.map(([href, label]) =>
        href.startsWith("#") ? (
          <a
            key={href}
            href={href}
            className="text-stone no-underline hover:text-white hover:underline underline-offset-4"
          >
            {label}
          </a>
        ) : (
          <Link
            key={href}
            to={href}
            className="text-stone no-underline hover:text-white hover:underline underline-offset-4"
          >
            {label}
          </Link>
        ),
      )}
    </div>
  );
}
