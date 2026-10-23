import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { canDraft } from "../components/intake";
import { Logo, Toran, usePageMeta } from "../components/ui";
import { aiEnabled, type PlanNotes, planNotes } from "../lib/ai";
import { longDate } from "../lib/dates";
import { inr, inrShort } from "../lib/format";
import { draftPlan } from "../lib/plan";
import { useStore } from "../store/store";
import { useAcceptPlan } from "../store/useAcceptPlan";

/** /new/generating: the drafted plan, with Gemini's notes when AI is on. */
export function Plan() {
  usePageMeta("Your plan");
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const accept = useAcceptPlan();
  const p = state.draft.profile;
  const plan = useMemo(() => draftPlan(p), [p]);
  const [drafting, setDrafting] = useState(!state.draft.generated);
  const [notes, setNotes] = useState<PlanNotes | undefined>();
  const [notesState, setNotesState] = useState<"loading" | "done" | "off">("loading");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (state.draft.generated) return;
    const t = window.setTimeout(() => {
      setDrafting(false);
      dispatch({ type: "draft", patch: { generated: true } });
    }, 1400);
    return () => window.clearTimeout(t);
  }, [state.draft.generated, dispatch]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!(await aiEnabled())) return live && setNotesState("off");
      const n = await planNotes(p, plan);
      if (!live) return;
      setNotes(n);
      setNotesState(n ? "done" : "off");
    })();
    return () => {
      live = false;
    };
  }, [p, plan]);

  // Accepting empties the draft before the router leaves this screen; don't bounce to /new then.
  if (!canDraft(p)) return accepted ? null : <Navigate to="/new" replace />;

  const onAccept = () => {
    if (state.session.signedIn) {
      setAccepted(true);
      accept();
    } else navigate("/signup?next=accept");
  };

  if (drafting)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper p-6 text-center">
        <Logo />
        <span className="spinner" role="status" aria-label="Drafting your plan" />
        <h1 className="font-serif text-[36px] leading-[1.1]">Drafting the plan for {plan.title}</h1>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-body">
          <li>
            Splitting {inr(plan.budget.total)} across {plan.budget.lines.length} categories
          </li>
          <li>Writing {plan.tasks} tasks against the date</li>
          <li>Listing {plan.vendors.length} vendors to book</li>
        </ul>
      </div>
    );

  const max = Math.max(...plan.budget.lines.map((l) => l.amount));
  return (
    <div className="min-h-dvh bg-paper">
      <Toran />
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-8">
        <Logo to="/" />
        <Link to="/new" className="link text-sm">
          ← Edit details
        </Link>
      </header>
      <main className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[720px] flex-col gap-2">
            <span className="eyebrow text-peacock">◆ First draft</span>
            <h1 className="font-serif text-[44px] leading-[1.05]">The plan for {plan.title}</h1>
            <p className="m-0 text-body">{plan.basis}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/new?mode=guided" className="btn btn-outline">
              Adjust
            </Link>
            <button type="button" className="btn btn-primary btn-lg" onClick={onAccept}>
              Accept and start planning
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-[24px]">Budget</h2>
              <span className="tabular text-sm font-semibold">{inr(plan.budget.total)}</span>
            </div>
            {plan.budget.lines.map((l) => (
              <div
                key={l.name}
                className="grid grid-cols-[130px_minmax(0,1fr)_80px] items-center gap-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)_96px]"
              >
                <span>{l.name}</span>
                <div
                  className="h-2 rounded-[2px]"
                  style={{ width: `${(l.amount / max) * 100}%`, background: l.color }}
                />
                <span className="tabular text-right">{inrShort(l.amount)}</span>
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-serif text-[24px]">Timeline</h2>
            <ol className="m-0 flex list-none flex-col p-0">
              {plan.timeline.map((t) => (
                <li
                  key={t.when}
                  className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-sand-2 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs font-medium text-amber-ink">{t.when}</span>
                  <span>{t.what}</span>
                </li>
              ))}
            </ol>
            <span className="text-xs text-muted">
              {plan.tasks} tasks in all{p.date ? `, leading to ${longDate(p.date)}` : ""}.
            </span>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-serif text-[24px]">Vendors to book</h2>
            <div className="flex flex-wrap gap-1.5">
              {plan.vendors.map((v) => (
                <span key={v} className="rounded-full bg-sand-2 px-2.5 py-1.5 text-xs font-medium">
                  {v}
                </span>
              ))}
            </div>
            <span className="text-sm text-rust-ink">{plan.vendorNote}</span>
          </section>
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
            <h2 className="font-serif text-[24px]">Guests · {plan.guests.total}</h2>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {plan.guests.groups.map((g) => (
                <li key={g.name} className="flex justify-between">
                  <span>{g.name}</span>
                  <span className="tabular">{g.count}</span>
                </li>
              ))}
            </ul>
            {plan.guests.note && <span className="text-xs text-peacock">{plan.guests.note}</span>}
          </section>
        </div>

        {notesState !== "off" && (
          <section
            aria-busy={notesState === "loading"}
            className="card-ai flex flex-col gap-4 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-[24px]">Plannr's notes</h2>
              <span className="eyebrow text-peacock">◆ Gemini</span>
            </div>
            {notesState === "loading" || !notes ? (
              <div className="flex flex-col gap-2" role="status" aria-label="Writing notes">
                {[90, 75, 82].map((w) => (
                  <span key={w} className="shimmer h-3 rounded" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : (
              <>
                <p className="m-0 text-[15px] leading-[1.55]">{notes.summary}</p>
                {notes.tips.length > 0 && (
                  <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
                    {notes.tips.map((t, i) => (
                      <li key={t.title} className="flex gap-3 rounded-xl bg-white p-3.5">
                        <span className="font-serif text-[28px] leading-none text-marigold italic">
                          {i + 1}
                        </span>
                        <span className="flex flex-col gap-1">
                          <span className="text-sm font-semibold">{t.title}</span>
                          <span className="text-sm leading-[1.5] text-body">{t.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {notes.watchouts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="eyebrow text-rust-ink">Watch out for</span>
                    {notes.watchouts.map((w) => (
                      <span key={w} className="text-sm text-body">
                        · {w}
                      </span>
                    ))}
                  </div>
                )}
                {notes.ideas.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="eyebrow text-amber-ink">{plan.ideas}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {notes.ideas.map((x) => (
                        <span key={x} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium">
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
