import { useCallback, useEffect, useMemo, useState } from "react";
import { type AiFailure, aiEnabled, planNotes } from "../../lib/ai";
import { draftPlan, type PlanDraft } from "../../lib/plan";
import { type PlanNotes, tailorPlan } from "../../lib/tailor";
import { useStore } from "../../store/store";

/** Where Gemini's draft stands: checking AI is on, writing, in, switched off, or not answering. */
export type GeminiState = "checking" | "drafting" | "done" | "off" | "failed";

/**
 * The plan for the current draft. Gemini is asked once per profile to tailor Plannr's standard draft;
 * its answer is kept on the draft, so revisiting the page or signing up doesn't ask again.
 */
export function useGeminiDraft(): {
  plan: PlanDraft;
  notes: PlanNotes | undefined;
  gemini: GeminiState;
  /** Why Gemini didn't answer, when it didn't. */
  why: AiFailure | undefined;
  retry: () => void;
} {
  const { state, dispatch } = useStore();
  const { profile, notes } = state.draft;
  const base = useMemo(() => draftPlan(profile), [profile]);
  const plan = useMemo(() => tailorPlan(base, notes), [base, notes]);
  const [gemini, setGemini] = useState<GeminiState>(notes ? "done" : "checking");
  const [why, setWhy] = useState<AiFailure>();

  const ask = useCallback(
    async (live: () => boolean) => {
      setGemini("checking");
      if (!(await aiEnabled())) return live() && setGemini("off");
      if (live()) setGemini("drafting");
      const answer = await planNotes(profile, base);
      if (!live()) return;
      if (answer.ok) {
        dispatch({ type: "draft", patch: { notes: answer.value } });
        return;
      }
      setWhy(answer.error);
      setGemini(answer.error === "off" ? "off" : "failed");
    },
    [profile, base, dispatch],
  );

  useEffect(() => {
    if (notes) {
      setGemini("done");
      return;
    }
    let live = true;
    void ask(() => live);
    return () => {
      live = false;
    };
  }, [notes, ask]);

  return { plan, notes, gemini, why, retry: () => void ask(() => true) };
}
