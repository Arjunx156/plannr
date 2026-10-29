import { type FormEvent, useEffect, useRef, useState } from "react";
import type { CommunityEvent, Message, PersonalEvent, Preview } from "../data/types";
import { aiEnabled, askAssistant } from "../lib/ai";
import { type AssistantContext, introFor, msgId, reply } from "../lib/assistant";
import { TODAY } from "../lib/dates";
import type { SpeechCode } from "../lib/voice";
import { proposalRipple } from "../shared/proposals";
import { toast, useStore } from "../store/store";
import { RipplePreview } from "./ripple";
import { HoldToSpeak, LangSelect } from "./voice";

/**
 * The event's assistant. Requests that change the plan (move a function, cut a
 * category, add a tip) go through the on-device intents, which return a preview the
 * planner approves. Everything else is answered by Gemini from the live plan and
 * computed facts, with the on-device answer as the fallback when AI is off.
 */
export function AssistantPanel({
  ev,
  context = "dashboard",
}: {
  ev: PersonalEvent | CommunityEvent;
  context?: AssistantContext;
}) {
  const { dispatch } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<SpeechCode>("EN");
  const [ai, setAi] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const thread = ev.assistant.thread;

  useEffect(() => {
    aiEnabled().then(setAi);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the thread grows
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length, busy]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    dispatch({ type: "pushMessage", eventId: ev.id, message: { id: msgId(), role: "user", text: message } });
    setText("");
    setBusy(true);
    const started = Date.now();
    const local = reply(ev, message, context);
    let answer: Message = local;
    if (!local.preview && !local.action) {
      const res = await askAssistant(ev, thread, message, lang);
      if (res)
        answer = {
          id: msgId(),
          role: "ai",
          text: res.text,
          source: res.source,
          translation: res.translation,
          lang: res.translation ? lang.toLowerCase() : undefined,
          ...(res.actions?.length ? { proposals: res.actions, proposalStatus: "pending" as const } : {}),
        };
    }
    await new Promise((r) => window.setTimeout(r, Math.max(0, 450 - (Date.now() - started))));
    dispatch({ type: "pushMessage", eventId: ev.id, message: answer });
    setBusy(false);
  };

  const decide = (m: Message, p: Preview, apply: boolean) => {
    dispatch({
      type: "previewStatus",
      eventId: ev.id,
      messageId: m.id,
      status: apply ? "applied" : "rejected",
    });
    if (apply) {
      dispatch({ type: "applyChange", eventId: ev.id, change: p.change });
      dispatch(toast(`Applied: ${p.tag}. The plan and its tasks are updated.`));
    }
  };

  const runAction = (m: Message) => {
    if (m.action?.id === "add-tip") {
      dispatch({ type: "addTip", eventId: ev.id });
      dispatch({ type: "messageActionDone", eventId: ev.id, messageId: m.id });
      dispatch(toast("Added ₹8,000 to Gifts & tips."));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <section
      aria-label="Plannr assistant"
      className="flex max-h-[calc(100dvh-32px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-peacock text-[11px] text-white"
          >
            ◆
          </span>
          <span className="font-serif text-xl leading-none">Ask Plannr</span>
        </span>
        <span
          className="eyebrow text-muted"
          title={ai ? "Answers by Gemini, grounded in this plan" : undefined}
        >
          {ai ? "Gemini · live plan" : "On-device"}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4" aria-live="polite">
        {thread.length === 0 && (
          <span className="text-sm leading-[1.5] text-body">{introFor(ev, context)}</span>
        )}
        {thread.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="max-w-[88%] self-end rounded-[14px_14px_4px_14px] bg-ink px-3.5 py-2.5 text-sm leading-normal text-paper"
            >
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="flex max-w-[94%] flex-col gap-2 text-sm leading-[1.5]">
              <span lang={m.lang} className="whitespace-pre-wrap">
                {m.text}
              </span>
              {m.translation && <span className="text-xs text-muted italic">{m.translation}</span>}
              {m.source && <span className="text-xs leading-[1.4] text-peacock">{m.source}</span>}
              {m.action && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary self-start"
                  disabled={m.action.done}
                  onClick={() => runAction(m)}
                >
                  {m.action.done ? `✓ ${m.action.label.replace(/^Add /, "Added ")}` : m.action.label}
                </button>
              )}
              {m.preview && (
                <PreviewCard
                  preview={m.preview}
                  onDecide={(apply) => decide(m, m.preview as Preview, apply)}
                />
              )}
              {m.proposals && <Proposal ev={ev} m={m} />}
              {m.footnote && <span className="text-xs text-muted">{m.footnote}</span>}
            </div>
          ),
        )}
        {busy && (
          <span role="status" aria-label="Plannr is thinking" className="flex gap-1 py-1">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-peacock"
                style={{ animation: `wave 0.9s ease-in-out ${d * 0.15}s infinite` }}
              />
            ))}
          </span>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5 px-[18px] pb-2">
        {ev.assistant.chips.map((c) => (
          <button key={c} type="button" className="chip chip-sm" disabled={busy} onClick={() => void send(c)}>
            {c}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-line px-[18px] py-3">
        <label htmlFor={`ask-${ev.id}`} className="sr-only">
          Ask about this event
        </label>
        <textarea
          id={`ask-${ev.id}`}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="Ask anything, or tell me what to change"
          className="resize-none bg-transparent text-sm leading-[1.4] outline-none placeholder:text-muted"
        />
        <div className="flex items-center gap-2">
          <HoldToSpeak code={lang} onText={setText} compact />
          <LangSelect value={lang} onChange={setLang} />
          <button type="submit" className="btn btn-primary btn-sm ml-auto" disabled={busy || !text.trim()}>
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

export function PreviewCard({ preview, onDecide }: { preview: Preview; onDecide: (apply: boolean) => void }) {
  return (
    <div className="card-ai flex flex-col gap-2.5 rounded-xl p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">{preview.title}</span>
        <span className="pill pill-ai">{preview.tag}</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {preview.rows.map((r) => (
          <li key={r.title} className="flex flex-col gap-0.5 text-[13px] leading-[1.4]">
            <span className={`flex justify-between gap-2 font-medium ${r.headsUp ? "text-amber-ink" : ""}`}>
              {r.title}
              {r.amount && <span className="tabular">{r.amount}</span>}
            </span>
            {r.from && (
              <span className="text-muted">
                <s>{r.from}</s> → <span className="text-ink">{r.to}</span>
              </span>
            )}
            {r.detail && <span className="text-muted">{r.detail}</span>}
          </li>
        ))}
      </ul>
      {preview.status === "pending" ? (
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecide(true)}>
            Apply changes
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDecide(false)}>
            Not now
          </button>
        </div>
      ) : (
        <span
          className={`text-xs font-semibold ${preview.status === "applied" ? "text-leaf-ink" : "text-muted"}`}
        >
          {preview.status === "applied" ? "✓ Applied" : "Not applied"}
        </span>
      )}
    </div>
  );
}

/** Changes the assistant proposed, as a preview of everything they move, applied only on yes. */
function Proposal({ ev, m }: { ev: PersonalEvent | CommunityEvent; m: Message }) {
  const { dispatch } = useStore();
  const status = m.proposalStatus ?? "pending";
  if (status !== "pending")
    return (
      <span className={`text-xs font-semibold ${status === "applied" ? "text-leaf-ink" : "text-muted"}`}>
        {status === "applied" ? "✓ Applied" : "Not applied"}
      </span>
    );
  const ripple = proposalRipple(ev, m.proposals ?? [], TODAY);
  if (!ripple)
    return (
      <span className="text-xs text-muted">The suggested change no longer fits the plan as it is now.</span>
    );
  const decide = (s: "applied" | "rejected") =>
    dispatch({ type: "previewStatus", eventId: ev.id, messageId: m.id, status: s });
  return (
    <RipplePreview ripple={ripple} onDone={() => decide("applied")} onCancel={() => decide("rejected")} />
  );
}
