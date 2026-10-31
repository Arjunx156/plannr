import { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Logo, Toran } from "../components/brand";
import { usePageMeta } from "../components/pageMeta";
import type { Kind } from "../data/baseTypes";
import type { PlannrEvent } from "../data/types";
import { emptyProfile } from "../lib/intake";
import { KIND_LABEL } from "../lib/profileRows";
import { useStore } from "../store/store";
import type { Action } from "../store/types";
import { Guided } from "./Guided";
import { Chat } from "./intake/Chat";

/**
 * How /new starts: adding a plan to an existing event, a kind chosen on the landing page
 * ("Plan a wedding"), or a clean slate when asked for one or when a prompt arrives from the
 * landing page. Otherwise the draft carries on where it was left.
 */
function startingDraft(params: URLSearchParams, events: PlannrEvent[], prompt: string | undefined): Action[] {
  const eventId = params.get("event");
  const type = params.get("type") as Kind | null;
  if (eventId) {
    const ev = events.find((e) => e.id === eventId);
    const reset: Action = { type: "draftReset", forEvent: eventId };
    if (!ev) return [reset];
    return [
      reset,
      { type: "draft", patch: { profile: { ...emptyProfile(), kind: ev.kind, names: ev.name } } },
    ];
  }
  if (type && KIND_LABEL[type]) {
    const functions = type === "wedding" ? ["Ceremony"] : [];
    return [
      { type: "draftReset" },
      { type: "draft", patch: { profile: { ...emptyProfile(), kind: type, functions } } },
    ];
  }
  return prompt || params.get("fresh") ? [{ type: "draftReset" }] : [];
}

export function Intake() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "guided" ? "guided" : "chat";
  usePageMeta(mode === "guided" ? "Guided plan" : "Describe your event", {
    description:
      "Tell Plannr about your wedding, birthday or community event in a sentence, by typing or speaking. It asks only for what's missing, then drafts the plan.",
  });
  const { state, dispatch } = useStore();
  const location = useLocation();
  const draft = state.draft;
  const booted = useRef(false);
  // The chat mounts only after the draft is set up, so its greeting can't be wiped by a reset.
  const [ready, setReady] = useState(false);
  // The landing page hands its sentence over in router state; keep it for the chat to send once.
  const [autoSend] = useState(() => (location.state as { prompt?: string } | null)?.prompt);

  // A layout effect, so the reset lands before the first paint and before the chat's own effects.
  useLayoutEffect(() => {
    if (booted.current) return;
    booted.current = true;
    for (const action of startingDraft(params, state.events, autoSend)) dispatch(action);
    // Drop it from history so a reload doesn't send it again.
    if (autoSend) window.history.replaceState({ ...window.history.state, usr: null }, "");
    setReady(true);
  }, [autoSend, dispatch, params, state.events]);

  const setMode = (m: "chat" | "guided") => {
    const next = new URLSearchParams(params);
    next.delete("type");
    next.delete("event");
    next.delete("fresh");
    if (m === "guided") next.set("mode", "guided");
    else next.delete("mode");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <Toran />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-10">
        <Logo to="/" />
        <div
          role="tablist"
          aria-label="Intake style"
          className="order-3 grid w-full grid-cols-2 rounded-[10px] bg-sand-2 p-1 text-[13px] font-semibold sm:order-none sm:w-[320px]"
        >
          {(["chat", "guided"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-9 rounded-[7px] ${mode === m ? "bg-surface shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-body hover:text-ink"}`}
            >
              {m === "chat" ? "Describe it" : "Guided form"}
            </button>
          ))}
        </div>
        <span className="text-[13px] font-medium text-body">
          {state.session.signedIn ? (
            <>
              Signed in as {state.session.firstName} ·{" "}
              <Link to="/events" className="link">
                My events
              </Link>
            </>
          ) : (
            <>
              Planning as guest ·{" "}
              <Link to="/signin?next=/new" className="link">
                Sign in
              </Link>
            </>
          )}
        </span>
      </header>
      {ready &&
        (mode === "chat" ? (
          <Chat draft={draft} autoSend={autoSend} onEdit={() => setMode("guided")} />
        ) : (
          <Guided />
        ))}
    </div>
  );
}
