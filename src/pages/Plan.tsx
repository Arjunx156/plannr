import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Logo, Toran } from "../components/brand";
import { canDraft } from "../components/intake";
import { usePageMeta } from "../components/pageMeta";
import { longDate } from "../lib/dates";
import { inr } from "../lib/format";
import type { PlanDraft } from "../lib/plan";
import { useStore } from "../store/store";
import { useAcceptPlan } from "../store/useAcceptPlan";
import { BudgetSection, GuestsSection, NotesSection, TimelineSection, VendorsSection } from "./plan/sections";
import { type GeminiState, useGeminiDraft } from "./plan/useGeminiDraft";

/** Long enough to read what's being drafted; the first draft never flashes past. */
const SETTLE_MS = 1400;

/** The drafting screen stays up for a moment on the first draft, and for as long as Gemini is writing. */
function useDrafting(gemini: GeminiState): boolean {
  const { state, dispatch } = useStore();
  const generated = state.draft.generated;
  const [settling, setSettling] = useState(!generated);
  useEffect(() => {
    if (!settling) return;
    const t = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [settling]);
  const drafting = settling || gemini === "checking" || gemini === "drafting";
  useEffect(() => {
    if (!drafting && !generated) dispatch({ type: "draft", patch: { generated: true } });
  }, [drafting, generated, dispatch]);
  return drafting;
}

function Drafting({ plan, gemini }: { plan: PlanDraft; gemini: GeminiState }) {
  const writing = gemini === "drafting";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-paper p-6 text-center">
      <Logo />
      <span className="spinner" role="status" aria-label="Drafting your plan" />
      <h1 className="font-serif text-[36px] leading-[1.1]">Drafting the plan for {plan.title}</h1>
      {writing && (
        <p className="m-0 max-w-[480px] text-sm text-peacock">
          Gemini is tailoring it to your city, date, guests and priorities.
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-body">
        <li>
          Splitting {inr(plan.budget.total)} for {plan.guests.total} guests
        </li>
        <li>Dating the tasks against {longDate(plan.date)}</li>
        <li>Choosing the vendors this event needs</li>
      </ul>
    </div>
  );
}

/** /new/generating: the drafted plan, tailored by Gemini when AI is on, before it's accepted. */
export function Plan() {
  usePageMeta("Your plan", { private: true });
  const { state } = useStore();
  const navigate = useNavigate();
  const accept = useAcceptPlan();
  const p = state.draft.profile;
  const { plan, notes, gemini, retry } = useGeminiDraft();
  const drafting = useDrafting(gemini);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  // ?accept=1: the planner signed in to save this draft, so finish what they started.
  const [params] = useSearchParams();
  const autoAccept = useRef(params.get("accept") === "1");

  const onAccept = async () => {
    if (!state.session.signedIn) return navigate("/signup?next=accept");
    setAccepted(true);
    setSaving(true);
    if (!(await accept())) {
      setAccepted(false);
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!autoAccept.current || drafting || !state.session.signedIn || !canDraft(p)) return;
    autoAccept.current = false;
    void onAccept();
  });

  // Accepting empties the draft before the router leaves this screen; don't bounce to /new then.
  if (!canDraft(p)) return accepted ? null : <Navigate to="/new" replace />;
  if (drafting) return <Drafting plan={plan} gemini={gemini} />;

  return (
    <div className="min-h-dvh bg-paper">
      <Toran />
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-8">
        <Logo to="/" />
        <Link to="/new" className="link text-sm">
          ← Edit details
        </Link>
      </header>
      <main id="main" className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-8 sm:px-8">
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
            <button type="button" className="btn btn-primary btn-lg" onClick={onAccept} disabled={saving}>
              {saving ? "Saving your plan…" : "Accept and start planning"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <BudgetSection plan={plan} />
          <TimelineSection plan={plan} dated={!!p.date} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <VendorsSection plan={plan} />
          <GuestsSection plan={plan} />
        </div>
        <NotesSection notes={notes} gemini={gemini} ideasLabel={plan.ideas} retry={retry} />
      </main>
    </div>
  );
}
