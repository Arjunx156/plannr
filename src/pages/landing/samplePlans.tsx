import { type JSX, useState } from "react";
import { Link } from "react-router";
import { keysOf } from "../../shared/guards";
import { SAMPLE_EVENT, SAMPLES, type SampleId } from "./content";
import { H2 } from "./layout";

/** The three sample plans side by side: the prompt, the first tasks and the vendors, with a way into the full demo. */
export function SamplePlans({
  demoMode,
  onDemo,
}: {
  demoMode: boolean;
  onDemo: (to: string) => void;
}): JSX.Element {
  const [sample, setSample] = useState<SampleId>("wedding");
  const s = SAMPLES[sample];
  return (
    <section
      id="sample"
      className="relative mx-5 my-10 flex flex-col gap-7 overflow-hidden rounded-3xl bg-sand p-6 sm:mx-10 sm:p-12 lg:mx-[72px]"
    >
      <div
        aria-hidden="true"
        className="kasavu-edge absolute inset-x-0 top-0 h-1.5 border-kasavu border-b-2"
      />
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-3">
          <span className="eyebrow text-[12px] text-amber-ink tracking-[0.1em]">
            Sample plan · no sign-up needed
          </span>
          <h2 className={H2}>See what one sentence produces</h2>
        </div>
        <div
          role="tablist"
          aria-label="Sample plans"
          className="flex self-start overflow-x-auto rounded-xl bg-stone p-1 font-semibold text-sm"
        >
          {keysOf(SAMPLES).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={sample === id}
              aria-controls="sample-panel"
              onClick={() => setSample(id)}
              className={`min-h-10 whitespace-nowrap rounded-[9px] px-4 ${sample === id ? "bg-surface text-ink" : "text-body hover:text-ink"}`}
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
          <span className="font-serif text-[22px] italic leading-[1.35]">“{s.prompt}”</span>
          <span className="eyebrow mt-2 text-muted">Plannr asked</span>
          <span className="text-body text-sm leading-normal">{s.asked}</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface p-[22px]">
          <span className="eyebrow text-muted">First 5 tasks</span>
          <ul className="m-0 flex list-none flex-col p-0 text-sm leading-[1.3]">
            {s.tasks.map((t, i) => (
              <li
                key={t.title}
                className={`flex justify-between gap-2.5 py-[9px] ${i < s.tasks.length - 1 ? "border-sand-2 border-b" : ""}`}
              >
                <span>{t.title}</span>
                <span className={`flex-none ${t.urgent ? "font-semibold text-rust-ink" : "text-muted"}`}>
                  {t.when}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-surface p-[22px]">
          <span className="eyebrow text-muted">Vendors it knew to add</span>
          <div className="flex flex-wrap gap-1.5 font-medium text-[13px]">
            {s.vendors.map((v) => (
              <span key={v} className="rounded-full bg-sand px-2.5 py-[7px]">
                {v}
              </span>
            ))}
          </div>
          <p className="m-0 mt-auto rounded-[10px] bg-peacock-tint p-3 text-[13px] text-peacock leading-[1.45]">
            ◆ {s.why}
          </p>
        </div>
      </div>
      {demoMode ? (
        <button
          type="button"
          className="btn btn-primary btn-lg self-start"
          onClick={() => onDemo(`/events/${SAMPLE_EVENT[sample]}`)}
        >
          Open the full sample plan
        </button>
      ) : (
        <Link to="/new" className="btn btn-primary btn-lg self-start">
          Plan yours like this
        </Link>
      )}
    </section>
  );
}
