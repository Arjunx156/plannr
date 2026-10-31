import { Link } from "react-router";
import { Toran } from "../../components/brand";
import { EXAMPLES, FAQS, FEATURES, OCCASIONS, STEPS } from "./content";
import { H2, PAD } from "./layout";

/** The three "how it works" columns: rules between them on wide screens. */
const STEP_COLUMN = ["md:pr-7", "border-line md:border-l md:px-7", "border-line md:border-l md:pl-7"];

/** A card for each kind of event, each opening a draft of that kind. */
export function Occasions() {
  return (
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
  );
}

/** How it works, in three steps. */
export function HowItWorks() {
  return (
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
  );
}

/** What's in a plan, and how the parts stay in step. */
export function Features() {
  return (
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
  );
}

/** The days Plannr was built for. */
export function Examples() {
  return (
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
  );
}

/** What it costs: nothing during early access, and what comes later. */
export function Pricing() {
  return (
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
          Plannr will stay free for small events. For big weddings we plan a one-time Celebration Pass, and
          for associations and committees a Community plan.
        </p>
        <p className="m-0 text-[15px] leading-[1.5] text-body">
          Nothing is charged today, and nothing will be without asking you first. Any event you start during
          early access stays free to finish.
        </p>
      </div>
    </section>
  );
}

/** Questions people ask before they start. */
export function Faq() {
  return (
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
  );
}
