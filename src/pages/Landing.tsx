import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Kolam, Logo, Pill, Toran, usePageMeta } from "../components/ui";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#occasions", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const EXAMPLE = "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December";

const DRAFT_BARS = [
  { name: "Catering", amount: "₹4,50,000", width: 100, color: "#6E1F2E" },
  { name: "Venue", amount: "₹3,20,000", width: 71, color: "#D9962B" },
  { name: "Décor", amount: "₹2,40,000", width: 53, color: "#3D7A4F" },
  { name: "Attire", amount: "₹2,20,000", width: 49, color: "#1F5F6B" },
  { name: "Photography", amount: "₹1,80,000", width: 40, color: "#B5452B" },
];

const OCCASIONS = [
  {
    type: "wedding",
    name: "Wedding",
    body: "Several functions over several days, each with its own budget and guests. Costs split between families.",
    span: "6–12 months of planning",
    bar: "#D9962B",
    ink: "text-amber-ink",
  },
  {
    type: "birthday",
    name: "Birthday",
    body: "A few hours, a theme the kids will remember, allergy notes for every guest, and return gifts sorted.",
    span: "1–4 weeks of planning",
    bar: "#5A6FB8",
    ink: "text-indigo-ink",
  },
  {
    type: "community",
    name: "Community event",
    body: "Pooled funds and sponsors, expense approvals, permits, stall sign-ups and volunteer shifts.",
    span: "1–3 months of planning",
    bar: "#3D7A4F",
    ink: "text-leaf-ink",
  },
  {
    type: "other",
    name: "Something else",
    body: "Housewarmings, anniversaries, naming ceremonies, reunions. Describe it and Plannr works out the shape.",
    span: "Any size",
    bar: "repeating-linear-gradient(90deg,#D9962B 0 12px,#3D7A4F 12px 24px)",
    ink: "text-body",
    dashed: true,
  },
];

const STEPS = [
  {
    title: "Describe your event",
    body: "Type or speak it in English, Malayalam, Hindi, Tamil and more. Plannr asks only what it still needs.",
  },
  {
    title: "Get an AI plan",
    body: "Budget, timeline, vendors, guests and ideas, tuned to your city, traditions and guest count. Each suggestion says why.",
  },
  {
    title: "Refine and execute",
    body: "Invite family and volunteers, track payments, send reminders on WhatsApp, and run the day from your phone.",
  },
];

const FEATURES = [
  {
    t: "Budget",
    d: "A split by category for your city and guest count. Track every advance and balance, read receipts, and split costs between families or funds.",
    c: "#6E1F2E",
  },
  {
    t: "Timeline",
    d: "Tasks worked back from the date, with owners, dependencies and reminders by email, push or WhatsApp.",
    c: "#D9962B",
  },
  {
    t: "Vendors",
    d: "The categories your traditions need, quotes side by side, and enquiry messages drafted for you.",
    c: "#3D7A4F",
  },
  {
    t: "Guests",
    d: "Groups, plus-ones, dietary and stay needs. A no-login RSVP page whose headcount updates catering.",
    c: "#5A6FB8",
  },
  {
    t: "Ideas",
    d: "Themes, menus, décor and return gifts with cost and effort. Add one and its tasks and budget lines appear.",
    c: "#B5452B",
  },
  {
    t: "AI assistant",
    d: "Ask a question or ask for a change, in your language. You see a preview of every edit before it happens.",
    c: "#1F5F6B",
  },
];

type SampleId = "wedding" | "birthday" | "mela";

const SAMPLES: Record<
  SampleId,
  {
    tab: string;
    prompt: string;
    asked: string;
    tasks: { t: string; when: string; urgent?: boolean }[];
    vendors: string[];
    why: string;
  }
> = {
  wedding: {
    tab: "Kerala wedding",
    prompt: "Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh, end of April.",
    asked: "Venue status · pre-wedding functions · top three priorities",
    tasks: [
      { t: "Confirm muhurtham with astrologer", when: "Week 1" },
      { t: "Visit both shortlisted venues", when: "Week 1" },
      { t: "Book photographer", when: "Week 2", urgent: true },
      { t: "Draft guest list with both families", when: "Week 3" },
      { t: "Sadhya tasting, 2 caterers", when: "Week 4" },
    ],
    vendors: [
      "Sadhya caterer",
      "Vadhyar",
      "Chenda melam",
      "Nadaswaram",
      "Kasavu weaver",
      "Jasmine & marigold florist",
      "+5 more",
    ],
    why: "Why sadhya: “Kerala-style” and a 250-guest lunch ceremony usually means a 22–28 item vegetarian feast on banana leaf.",
  },
  birthday: {
    tab: "Space birthday",
    prompt: "Space-themed 6th birthday at home for Aarav, 30 kids and 20 adults, ₹40,000, in three weeks.",
    asked: "Allergies · entertainer or games · return gifts",
    tasks: [
      { t: "Book the planetarium show", when: "Week 1" },
      { t: "Order the rocket cake, nut-free", when: "Week 1", urgent: true },
      { t: "Send the invite to the class group", when: "Week 1" },
      { t: "Buy 30 rocket kits for return gifts", when: "Week 2" },
      { t: "Planet balloons and star backdrop", when: "Week 3" },
    ],
    vendors: ["Cake baker", "Planetarium show", "Snacks caterer", "Balloon décor", "Return gifts", "+2 more"],
    why: "Why a nut-free cake: Plannr asked about allergies, and 3 of the 30 kids have nut allergies.",
  },
  mela: {
    tab: "Diwali mela",
    prompt: "Diwali mela for our society: stalls and a cultural night, 600 people, ₹2.5 lakh, 12 volunteers.",
    asked: "Date and grounds · permits already filed · how stalls pay",
    tasks: [
      { t: "File police permission for sound", when: "Week 1", urgent: true },
      { t: "Open stall sign-ups at ₹2,500", when: "Week 1" },
      { t: "Confirm three sponsors", when: "Week 2" },
      { t: "Build the volunteer shifts", when: "Week 3" },
      { t: "Fire safety check for diya stalls", when: "Week 4" },
    ],
    vendors: [
      "Sound & lighting",
      "Stall tents",
      "Security guards",
      "Mobile toilets",
      "Pass printing",
      "+3 more",
    ],
    why: "Why police permission first: amplified sound on open ground after 7 pm needs it, and it takes about 3 weeks.",
  },
};

const TESTIMONIALS = [
  {
    quote:
      "Both our families could see the same budget. The 60/40 split stopped every awkward money conversation before it started.",
    who: "Devika & Arjun",
    where: "Married in Thrissur, 320 guests",
    color: "#D9962B",
  },
  {
    quote:
      "I had ten days to plan a dinosaur party. It gave me a shopping list, a run sheet and which kids couldn't have peanuts.",
    who: "Shalini R.",
    where: "Parent, Bengaluru",
    color: "#5A6FB8",
  },
  {
    quote:
      "Volunteer shifts, stall fees and the police permission in one place. Our Ganeshotsav committee finally stopped living in WhatsApp.",
    who: "Mahesh Kulkarni",
    where: "Secretary, Sai Residency, Pune",
    color: "#3D7A4F",
  },
];

const FAQS = [
  {
    q: "Will the AI change my plan without asking?",
    a: "No. Every change, whether you asked for it or Plannr noticed something, shows up as a preview first. Nothing in your budget, tasks or guest list moves until you or a co-planner approves it.",
  },
  {
    q: "Does it know local traditions and prices?",
    a: "For the cities it covers, yes. Vendor categories, rituals and price ranges come from your city and the traditions you describe: sadhya and chenda melam in Kochi, a mandap and baraat in Jaipur. Every suggestion says why, so you can see when it's estimating.",
  },
  {
    q: "Can my family use it in Malayalam or Hindi?",
    a: "Yes. The assistant understands and replies in nine Indian languages, typed or spoken, whatever the app itself is set to. Each person picks their own language.",
  },
  {
    q: "Do guests need to download anything to RSVP?",
    a: "No. Guests get a link on WhatsApp or email and reply on a simple page with no app and no login. Their answers update the headcount, and catering follows once you approve.",
  },
  {
    q: "Who can see our budget?",
    a: "Only the people you invite, with the role you give them. Co-planners see and edit everything. Helpers and volunteers see their own tasks, not the money.",
  },
];

const PAD = "px-5 sm:px-10 lg:px-[72px]";
const H2 = "font-serif text-[clamp(34px,4.6vw,48px)] leading-[1.05] tracking-[-0.015em]";

export function Landing() {
  usePageMeta(
    "Plannr",
    "Describe your wedding, birthday or community event in one sentence. Plannr drafts a budget, timeline, vendor checklist and guest list, all kept in sync. You approve every change.",
  );
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sample, setSample] = useState<SampleId>("wedding");
  const s = SAMPLES[sample];

  const start = (e: FormEvent) => {
    e.preventDefault();
    navigate("/new", { state: { prompt: prompt.trim() || EXAMPLE } });
  };

  return (
    <div className="bg-paper text-ink">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
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
            to="/signin"
            className="hidden text-[15px] font-medium text-cream no-underline hover:text-white sm:inline"
          >
            Log in
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
              to="/signin"
              className="rounded-lg px-2 py-3 text-[17px] font-medium text-cream no-underline hover:bg-white/10"
            >
              Log in
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
              One conversation gives you a budget, a timeline, a vendor checklist and a guest list, all kept
              in sync. Plannr drafts; you approve every change.
            </p>
            <form
              onSubmit={start}
              className="flex max-w-[620px] flex-col gap-3 rounded-2xl bg-white p-3 text-ink shadow-[0_20px_40px_rgba(20,5,10,.25)] sm:flex-row sm:items-center sm:pl-5"
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
            <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-white p-[18px] text-ink shadow-[0_24px_50px_rgba(20,5,10,.35)] lg:absolute lg:bottom-[30px] lg:left-0 lg:mt-0 lg:w-[360px]">
              <Pill tone="warn">Booking window closing</Pill>
              <span className="text-[15px] leading-[1.4] font-medium">
                Photographers in Kochi book out 6 months ahead. Book by 14 June.
              </span>
              <span className="text-xs leading-[1.4] text-peacock">
                Why: December is peak wedding season in Kerala.
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
                className={`group flex flex-col overflow-hidden rounded-2xl bg-white text-ink no-underline transition-shadow hover:shadow-[0_12px_32px_rgba(60,40,20,.10)] ${o.dashed ? "border border-dashed border-line-2" : "border border-line"}`}
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
                className={`flex flex-col gap-3 pt-6 pb-4 md:pb-0 ${i === 0 ? "md:pr-7" : i === 1 ? "border-line md:border-l md:px-7" : "border-line md:border-l md:pl-7"} ${i > 0 ? "border-t md:border-t-0" : ""}`}
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
                  className={`min-h-10 rounded-[9px] px-4 whitespace-nowrap ${sample === id ? "bg-white text-ink" : "text-body hover:text-ink"}`}
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
            <div className="flex flex-col gap-3 rounded-[14px] bg-white p-[22px]">
              <span className="eyebrow text-muted">The prompt</span>
              <span className="font-serif text-[22px] leading-[1.35] italic">“{s.prompt}”</span>
              <span className="eyebrow mt-2 text-muted">Plannr asked</span>
              <span className="text-sm leading-normal text-body">{s.asked}</span>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-[22px]">
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
            <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-[22px]">
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
          <Link to={`/sample/${sample}`} className="btn btn-primary btn-lg self-start">
            Open the full sample plan
          </Link>
        </section>

        <section className={`flex flex-col gap-8 py-[72px] ${PAD}`} aria-labelledby="voices">
          <h2 id="voices" className={H2}>
            From people who've run the day
          </h2>
          <div className="grid gap-8 md:grid-cols-3 md:gap-5">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.who}
                className="m-0 flex flex-col gap-[18px] border-t-2 pt-5"
                style={{ borderColor: t.color }}
              >
                <blockquote className="m-0 font-serif text-[22px] leading-[1.4]">“{t.quote}”</blockquote>
                <figcaption className="flex flex-col gap-[3px] text-sm leading-[1.3]">
                  <b className="font-semibold">{t.who}</b>
                  <span className="text-muted">{t.where}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section
          id="pricing"
          className={`grid scroll-mt-4 items-stretch gap-5 pt-6 pb-[72px] md:grid-cols-2 xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1fr)] ${PAD}`}
        >
          <div className="flex flex-col gap-3.5 md:col-span-2 xl:col-span-1">
            <span className="eyebrow text-[12px] tracking-[0.1em] text-amber-ink">Pricing</span>
            <h2 className={H2}>Free to plan. Pro when it gets big.</h2>
          </div>
          <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-white p-7">
            <div className="flex items-baseline justify-between font-serif text-[30px] leading-none">
              <h3>Free</h3>
              <span>₹0</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-[9px] p-0 text-[15px] leading-[1.4] text-body">
              <li>1 active event</li>
              <li>Full AI plan: budget, tasks, vendors, ideas</li>
              <li>Up to 100 guests with RSVP page</li>
              <li>2 co-planners</li>
              <li>Email reminders</li>
            </ul>
            <Link to="/new" className="btn btn-outline btn-lg mt-auto border-ink">
              Start free
            </Link>
          </div>
          <div className="relative flex flex-col gap-4 overflow-hidden rounded-[18px] bg-ink p-7 text-paper">
            <Toran size="beads" className="absolute inset-x-0 top-0" />
            <div className="mt-2 flex items-baseline justify-between font-serif text-[30px] leading-none">
              <h3>Pro</h3>
              <span>
                ₹349<span className="font-sans text-[15px] text-line-2"> /month</span>
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-[9px] p-0 text-[15px] leading-[1.4] text-stone">
              <li>Unlimited events and guests</li>
              <li>Receipt and contract reading</li>
              <li>WhatsApp reminders and vendor messages</li>
              <li>Seating planner, passes and volunteer check-in</li>
              <li>Unlimited collaborators with roles</li>
            </ul>
            <Link to="/signup?plan=pro" className="btn btn-gold btn-lg mt-auto">
              Try Pro free for 14 days
            </Link>
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
              <span className="text-line-2">Made in Kochi. Available in 9 Indian languages.</span>
            </div>
            <FooterCol
              title="Product"
              links={[
                ["#how", "How it works"],
                ["#occasions", "Templates"],
                ["#pricing", "Pricing"],
              ]}
            />
            <FooterCol
              title="Plan a"
              links={[
                ["/new?type=wedding", "Wedding"],
                ["/new?type=birthday", "Birthday"],
                ["/new?type=community", "Community event"],
              ]}
            />
            <div className="flex flex-col">
              <span className="font-semibold text-white">Company</span>
              <span>Privacy</span>
              <span>Terms</span>
              <span>Contact</span>
            </div>
          </div>
          <p className={`m-0 text-[13px] text-faint ${PAD}`}>© 2026 Plannr · Engineered by Arjun Krishnan</p>
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
