import type { JSX, ReactNode } from "react";
import { cssVars, percent } from "../../components/cssVars";
import { SWATCH_BG } from "../../components/ui";
import type { AiFailure } from "../../lib/ai";
import { dayMonth, longDate } from "../../lib/dates";
import { inr, inrShort } from "../../lib/format";
import type { PlanDraft } from "../../lib/plan";
import type { PlanNotes } from "../../lib/tailor";
import { assertNever } from "../../shared/result";
import type { GeminiState } from "./useGeminiDraft";

/** One card on the plan page, with who drafted it beside the heading when that's worth saying. */
function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-[24px]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Says plainly whether Gemini drafted a part of the plan or it's Plannr's standard draft. */
function DraftedBy({ gemini }: { gemini: boolean }) {
  return gemini ? (
    <span className="eyebrow text-peacock">◆ Drafted by Gemini</span>
  ) : (
    <span className="eyebrow text-muted">Plannr's standard draft</span>
  );
}

/** The draft budget, line by line, with bars to compare. */
export function BudgetSection({ plan }: { plan: PlanDraft }): JSX.Element {
  const max = Math.max(...plan.budget.lines.map((l) => l.amount));
  return (
    <Section title={`Budget · ${inr(plan.budget.total)}`} aside={<DraftedBy gemini={plan.byGemini.budget} />}>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {plan.budget.lines.map((l) => (
          <li
            key={l.name}
            className="grid grid-cols-[130px_minmax(0,1fr)_80px] items-center gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[160px_minmax(0,1fr)_96px]"
          >
            <span>{l.name}</span>
            <span
              aria-hidden="true"
              ref={cssVars({ "--w": percent(l.amount / max) })}
              className={`h-2 w-(--w) rounded-[2px] ${SWATCH_BG[l.color]}`}
            />
            <span className="tabular text-right">{inrShort(l.amount)}</span>
            {l.why && <span className="col-span-3 text-muted text-xs leading-normal">{l.why}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The draft timeline, grouped from early on to the day. */
export function TimelineSection({ plan, dated }: { plan: PlanDraft; dated: boolean }): JSX.Element {
  return (
    <Section title="Timeline" aside={<DraftedBy gemini={plan.byGemini.timeline} />}>
      <ol className="m-0 flex list-none flex-col p-0">
        {plan.timeline.map((t) => (
          <li
            key={`${t.due}-${t.title}`}
            className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-sand-2 border-t py-2.5 text-sm"
          >
            <time dateTime={t.due} className="font-medium font-mono text-amber-ink text-xs uppercase">
              {dayMonth(t.due)}
            </time>
            <span className="flex flex-col gap-0.5">
              <span>{t.title}</span>
              {t.why && <span className="text-muted text-xs leading-normal">{t.why}</span>}
            </span>
          </li>
        ))}
      </ol>
      <span className="text-muted text-xs">
        The first {plan.timeline.length} of {plan.tasks} tasks
        {dated ? `, leading to ${longDate(plan.date)}` : ""}.
      </span>
    </Section>
  );
}

/** The vendors to book, in the order to book them. */
export function VendorsSection({ plan }: { plan: PlanDraft }): JSX.Element {
  return (
    <Section title="Vendors to book" aside={<DraftedBy gemini={plan.byGemini.vendors} />}>
      <ul className="m-0 grid list-none gap-x-4 gap-y-2 p-0 text-sm sm:grid-cols-2">
        {plan.vendors.map((v) => (
          <li key={v.name} className="flex flex-col gap-0.5">
            <span className="font-medium">{v.name}</span>
            {v.why && <span className="text-muted text-xs leading-normal">{v.why}</span>}
          </li>
        ))}
      </ul>
      {!plan.byGemini.vendors && <span className="text-rust-ink text-sm">{plan.vendorNote}</span>}
    </Section>
  );
}

/** The draft guest count, split by function. */
export function GuestsSection({ plan }: { plan: PlanDraft }): JSX.Element {
  return (
    <Section title={`Guests · ${plan.guests.total}`}>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
        {plan.guests.groups.map((g) => (
          <li key={g.name} className="flex justify-between">
            <span>{g.name}</span>
            <span className="tabular">{g.count}</span>
          </li>
        ))}
      </ul>
      {plan.guests.note && <span className="text-peacock text-xs">{plan.guests.note}</span>}
    </Section>
  );
}

/** Gemini's advice on the draft: the shape of it, tips, what to watch, and ideas. */
function Notes({ notes, ideasLabel }: { notes: PlanNotes; ideasLabel: string }) {
  return (
    <>
      <p className="m-0 text-[15px] leading-[1.55]">{notes.summary}</p>
      {notes.tips.length > 0 && (
        <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
          {notes.tips.map((t, i) => (
            <li key={t.title} className="flex gap-3 rounded-xl bg-surface p-3.5">
              <span aria-hidden="true" className="font-serif text-[28px] text-marigold italic leading-none">
                {i + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-sm">{t.title}</span>
                <span className="text-body text-sm leading-[1.5]">{t.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {notes.watchouts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="eyebrow text-rust-ink">Watch out for</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {notes.watchouts.map((w) => (
              <li key={w} className="text-body text-sm">
                · {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.ideas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="eyebrow text-amber-ink">{ideasLabel}</h3>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {notes.ideas.map((x) => (
              <li key={x} className="rounded-full bg-surface px-3 py-1.5 font-medium text-xs">
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** What happened to Gemini's draft, in the words the plan page uses. */
export function failureLine(why: AiFailure | undefined): string {
  switch (why) {
    case "offline":
      return "You're offline, so this is Plannr's standard draft.";
    case "busy":
      return "Gemini is busy right now, so this is Plannr's standard draft.";
    case "off":
      return "Gemini isn't switched on here, so this is Plannr's standard draft.";
    case undefined:
    case "timeout":
      return "Gemini didn't answer in time, so this is Plannr's standard draft.";
    case "failed":
      return "Gemini's answer didn't come through, so this is Plannr's standard draft.";
    default:
      return assertNever(why);
  }
}

/** Gemini's notes on the draft, or why they're missing and a way to ask again. */
export function NotesSection({
  notes,
  gemini,
  why,
  ideasLabel,
  retry,
}: {
  notes: PlanNotes | undefined;
  gemini: GeminiState;
  why: AiFailure | undefined;
  ideasLabel: string;
  retry: () => void;
}): JSX.Element | null {
  if (gemini === "failed")
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5">
        <p className="m-0 max-w-[620px] text-body text-sm">
          {failureLine(why)} It works just as well as a starting point, or Gemini can try again.
        </p>
        <button type="button" className="btn btn-outline" onClick={retry}>
          Ask Gemini again
        </button>
      </section>
    );
  if (!notes) return null;
  return (
    <section className="card-ai flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-[24px]">Plannr's notes</h2>
        <span className="eyebrow text-peacock">◆ Gemini</span>
      </div>
      <Notes notes={notes} ideasLabel={ideasLabel} />
    </section>
  );
}
