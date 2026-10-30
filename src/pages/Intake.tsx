import { type FormEvent, type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { canDraft, PriorityPicker } from "../components/intake";
import { Logo, Toran, usePageMeta } from "../components/ui";
import { HoldToSpeak, LangSelect } from "../components/voice";
import type { Kind, Profile } from "../data/types";
import { extractWithAi, mergeAiProfile } from "../lib/ai";
import { emptyProfile, KIND_LABEL, type Question } from "../lib/intake";
import type { SpeechCode } from "../lib/voice";
import { type ChatTurn, type Draft, useStore } from "../store/store";
import { Guided } from "./Guided";
import {
  acknowledge,
  DONE,
  KIND_FROM_CHIP,
  opener,
  pendingField,
  questionAfter,
  readAnswer,
  turnId,
} from "./intake/conversation";
import { AiMark, ProfilePanel } from "./intake/ProfilePanel";

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
    const type = params.get("type") as Kind | null;
    const eventId = params.get("event");
    const prompt = autoSend;
    if (eventId) {
      const ev = state.events.find((e) => e.id === eventId);
      dispatch({ type: "draftReset", forEvent: eventId });
      if (ev)
        dispatch({ type: "draft", patch: { profile: { ...emptyProfile(), kind: ev.kind, names: ev.name } } });
    } else if (type && KIND_LABEL[type]) {
      dispatch({ type: "draftReset" });
      dispatch({
        type: "draft",
        patch: {
          profile: { ...emptyProfile(), kind: type, functions: type === "wedding" ? ["Ceremony"] : [] },
        },
      });
    } else if (prompt || params.get("fresh")) {
      dispatch({ type: "draftReset" });
    }
    // Drop it from history so a reload doesn't send it again.
    if (prompt) window.history.replaceState({ ...window.history.state, usr: null }, "");
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

function Chat({ draft, autoSend, onEdit }: { draft: Draft; autoSend?: string; onEdit: () => void }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [lang, setLang] = useState<SpeechCode>("EN");
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sentAuto = useRef(false);

  const p = draft.profile;
  const last = draft.chat[draft.chat.length - 1];
  const pending = last?.role === "ai" ? last.question : undefined;
  const ready = canDraft(p);

  useEffect(() => {
    if (draft.chat.length === 0) {
      const greeting = p.kind
        ? p.kind === "other" && p.names
          ? `Let's plan ${p.names}. Where is it, roughly when, how many guests and what budget?`
          : `Tell me about the ${KIND_LABEL[p.kind].toLowerCase()}: where, roughly when, how many guests and the budget. I'll ask only for what's missing.`
        : "Describe the event in a sentence or two: what, where, roughly when, how many people and the budget. I'll ask only for what's missing.";
      dispatch({ type: "draft", patch: { chat: [{ id: turnId(), role: "ai", text: greeting }] } });
    }
  }, [draft.chat.length, p.kind, p.names, dispatch]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the conversation grows
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [draft.chat.length, thinking]);

  const respond = (aiTurn: ChatTurn, patch: Partial<Draft>) => {
    setThinking(true);
    window.setTimeout(() => {
      const current = draftRef.current;
      dispatch({ type: "draft", patch: { ...patch, chat: [...current.chat, aiTurn] } });
      setThinking(false);
    }, 650);
  };

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || thinking) return;
    const current = draftRef.current;
    const field = pendingField(current);
    const isFirst = !current.chat.some((t) => t.role === "user");
    // The on-device parse lands instantly; Gemini fills what it missed a moment later.
    const local = readAnswer(message, current.profile, field);
    const asked =
      field && ["venue", "extras", "priorities"].includes(field)
        ? [...new Set([...current.asked, field])]
        : current.asked;
    const userTurn: ChatTurn = { id: turnId(), role: "user", text: message };
    dispatch({ type: "draft", patch: { profile: local, asked, chat: [...current.chat, userTurn] } });
    setText("");
    setThinking(true);
    const started = Date.now();
    const ai = await extractWithAi(message, current.profile, field);
    const next = mergeAiProfile(local, ai);
    const q = questionAfter(next, asked, field);
    const aiLead = (isFirst || field === "extras") && ai?.reply;
    let lead =
      aiLead || (isFirst ? opener(next) : field === "extras" ? acknowledge(current.profile, next) : "");
    if (field === "date" && !next.date)
      lead = "I couldn't place that date. A month is enough, like “December” or “in 3 weeks”.";
    if (!q) lead = lead ? `${lead} ${DONE}` : DONE;
    else if (q.field === "priorities" && lead) lead = `${lead} Last one:`;
    await new Promise((r) => window.setTimeout(r, Math.max(0, 650 - (Date.now() - started))));
    const aiTurn: ChatTurn = { id: turnId(), role: "ai", text: lead, question: q ?? undefined };
    dispatch({ type: "draft", patch: { profile: next, chat: [...draftRef.current.chat, aiTurn] } });
    setThinking(false);
  };

  useEffect(() => {
    if (autoSend && !sentAuto.current && draft.chat.length === 1 && draft.chat[0]?.role === "ai") {
      sentAuto.current = true;
      void send(autoSend);
    }
  });

  const pick = (q: Question, option: string) => {
    const current = draftRef.current;
    if (q.field === "venue") {
      const profile = { ...current.profile, venueStatus: option as Profile["venueStatus"] };
      const asked = [...new Set([...current.asked, "venue" as const])];
      dispatch({ type: "draft", patch: { profile, asked } });
      const nq = questionAfter(profile, asked, "venue");
      respond({ id: turnId(), role: "ai", text: nq ? "" : DONE, question: nq ?? undefined }, {});
    }
    if (q.field === "kind") {
      const profile = { ...current.profile, kind: KIND_FROM_CHIP[option] ?? "other" };
      dispatch({ type: "draft", patch: { profile } });
      const nq = questionAfter(profile, current.asked);
      respond({ id: turnId(), role: "ai", text: "", question: nq ?? undefined }, {});
    }
  };

  const togglePriority = (option: string, list: "priorities" | "cuts") => {
    const current = draftRef.current;
    const prev = current.profile[list];
    const has = prev.includes(option);
    const nextList = has
      ? prev.filter((x) => x !== option)
      : list === "priorities" && prev.length >= 3
        ? prev
        : [...prev, option];
    dispatch({
      type: "draft",
      patch: {
        profile: { ...current.profile, [list]: nextList },
        asked: [...new Set([...current.asked, "priorities" as const])],
      },
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(text);
    }
  };

  const addImages = (files: FileList | null) => {
    if (!files?.length) return;
    const added = [...files]
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setImages((imgs) => [...imgs, ...added]);
    const current = draftRef.current;
    dispatch({
      type: "draft",
      patch: {
        profile: {
          ...current.profile,
          inspiration: [...current.profile.inspiration, ...added.map((a) => a.name)],
        },
      },
    });
  };

  const draftPlan = () => {
    dispatch({ type: "draft", patch: { generated: false } });
    navigate("/new/generating");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-5 px-4 pt-7 pb-6 sm:px-10 xl:pr-20 xl:pl-[120px]">
        <div className="flex flex-col gap-5" aria-live="polite">
          {draft.chat.map((t, i) =>
            t.role === "user" ? (
              <div
                key={t.id}
                className="rise max-w-[86%] self-end rounded-[18px_18px_4px_18px] bg-ink px-[18px] py-3.5 text-base leading-normal whitespace-pre-wrap text-paper sm:max-w-[76%]"
              >
                {t.text}
              </div>
            ) : (
              <div key={t.id} className="rise flex max-w-full gap-3 sm:max-w-[88%]">
                <AiMark />
                <div className="flex min-w-0 flex-col gap-3 text-base leading-[1.55]">
                  {t.text && <span>{t.text}</span>}
                  {t.question && <span className="font-semibold">{t.question.prompt}</span>}
                  {t.question?.options && (
                    <div className="flex flex-wrap gap-2">
                      {t.question.options.map((o) => {
                        const on =
                          (t.question?.field === "venue" && p.venueStatus === o) ||
                          (t.question?.field === "kind" && p.kind === KIND_FROM_CHIP[o]);
                        const live = i === draft.chat.length - 1;
                        return (
                          <button
                            key={o}
                            type="button"
                            disabled={!live && !on}
                            aria-pressed={on}
                            onClick={() => t.question && pick(t.question, o)}
                            className={`inline-flex min-h-9 items-center rounded-full border px-[13px] text-sm font-medium ${on ? "border-peacock bg-peacock-tint text-peacock" : "border-line text-muted hover:border-line-2 hover:text-ink disabled:hover:border-line disabled:hover:text-muted"}`}
                          >
                            {on ? `✓ ${o}` : o}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {t.question?.field === "priorities" && (
                    <PriorityPicker profile={p} onToggle={togglePriority} />
                  )}
                </div>
              </div>
            ),
          )}
          {thinking && (
            <div className="flex items-center gap-3" role="status" aria-label="Plannr is thinking">
              <AiMark />
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-peacock"
                    style={{ animation: `wave 0.9s ease-in-out ${d * 0.15}s infinite` }}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="sticky bottom-3 mt-auto flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-ink bg-surface py-3 pr-3 pl-[18px] shadow-[0_8px_24px_rgba(40,25,10,.08)]"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message Plannr
          </label>
          <textarea
            id="chat-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              ready
                ? "Add anything else, or press Draft my plan"
                : draft.chat.some((t) => t.role === "user")
                  ? "Type your answer"
                  : "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December"
            }
            className="resize-none bg-transparent text-base leading-[1.4] outline-none placeholder:text-muted"
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addImages(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-sm border-line bg-transparent font-medium"
              onClick={() => fileRef.current?.click()}
            >
              + Inspiration image
            </button>
            <HoldToSpeak code={lang} onText={setText} />
            <LangSelect value={lang} onChange={setLang} />
            <div className="ml-auto flex gap-2">
              {text.trim() && (
                <button type="submit" className="btn btn-secondary btn-sm" disabled={thinking}>
                  Send
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready || thinking}
                onClick={draftPlan}
              >
                Draft my plan
              </button>
            </div>
          </div>
        </form>
        <div ref={endRef} />
      </div>
      <ProfilePanel profile={p} asking={pending?.field} images={images} onAdd={addImages} onEdit={onEdit} />
    </div>
  );
}
