import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { Message, Preview } from "../data/messageTypes";
import type { CommunityEvent, PersonalEvent } from "../data/types";
import { type AssistantContext, introFor, reply } from "../lib/assistant";
import { type AssistantAnswer, streamAssistantAnswer } from "../lib/assistantClient";
import { msgId } from "../lib/messageId";
import type { SpeechCode } from "../lib/voice";
import { toast, useStore } from "../store/store";
import { PreviewCard, Proposal } from "./proposalCard";
import { ThinkingDots } from "./ui";
import { useAiOn } from "./useAiOn";
import { HoldToSpeak, LangSelect } from "./voice";

type AnyEvent = PersonalEvent | CommunityEvent;

/** Shortest time before an answer appears. */
const MIN_ANSWER_MS = 450;

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));

/** Gemini's answer as a thread message; proposed changes wait for the planner's yes. */
function fromModel(res: AssistantAnswer, lang: SpeechCode): Message {
  return {
    id: msgId(),
    role: "ai",
    text: res.text,
    source: res.source,
    translation: res.translation,
    lang: res.translation ? lang.toLowerCase() : undefined,
    ...(res.actions?.length ? { proposals: res.actions, proposalStatus: "pending" as const } : {}),
  };
}

/**
 * The on-device answer when it previews a change or offers an action; otherwise Gemini's,
 * streamed into `onDraft`, with the on-device answer as the fallback.
 */
async function answerFor(
  ev: AnyEvent,
  thread: Message[],
  question: string,
  opts: { context: AssistantContext; lang: SpeechCode; onDraft: (soFar: string) => void },
): Promise<Message> {
  const local = reply(ev, question, opts.context);
  if (local.preview || local.action) return local;
  const res = await streamAssistantAnswer(ev, thread, question, opts.lang, opts.onDraft);
  return res ? fromModel(res, opts.lang) : local;
}

/** The conversation: asking, deciding on a previewed change, and running an offered action. */
function useConversation(ev: AnyEvent, context: AssistantContext, lang: SpeechCode) {
  const { dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  /** The answer so far while it's being written. */
  const [draft, setDraft] = useState("");
  const thread = ev.assistant.thread;

  const ask = async (message: string) => {
    dispatch({ type: "pushMessage", eventId: ev.id, message: { id: msgId(), role: "user", text: message } });
    setBusy(true);
    const started = Date.now();
    const answer = await answerFor(ev, thread, message, { context, lang, onDraft: setDraft });
    // An instant answer reads as canned; a short beat reads as considered.
    await pause(MIN_ANSWER_MS - (Date.now() - started));
    dispatch({ type: "pushMessage", eventId: ev.id, message: answer });
    setDraft("");
    setBusy(false);
  };

  const decide = (m: Message, p: Preview, apply: boolean) => {
    const status = apply ? "applied" : "rejected";
    dispatch({ type: "previewStatus", eventId: ev.id, messageId: m.id, status });
    if (!apply) return;
    dispatch({ type: "applyChange", eventId: ev.id, change: p.change });
    dispatch(toast(`Applied: ${p.tag}. The plan and its tasks are updated.`));
  };

  const runAction = (m: Message) => {
    if (m.action?.id !== "add-tip") return;
    dispatch({ type: "addTip", eventId: ev.id });
    dispatch({ type: "messageActionDone", eventId: ev.id, messageId: m.id });
    dispatch(toast("Added ₹8,000 to Gifts & tips."));
  };

  return { thread, busy, draft, ask, decide, runAction };
}

/**
 * The event's assistant. Requests that change the plan (move a function, cut a
 * category, add a tip) go through the on-device intents, which return a preview the
 * planner approves. Everything else is answered by Gemini from the live plan and
 * computed facts, with the on-device answer as the fallback when AI is off.
 */
export function AssistantPanel({ ev, context = "dashboard" }: { ev: AnyEvent; context?: AssistantContext }) {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<SpeechCode>("EN");
  const talk = useConversation(ev, context, lang);
  const { thread, busy, draft } = talk;
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the thread or the answer being written grows
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length, busy, draft.length > 0 ? Math.floor(draft.length / 80) : 0]);

  const send = (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setText("");
    void talk.ask(message);
  };

  return (
    <section
      aria-label="Plannr assistant"
      className="flex max-h-[calc(100dvh-32px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <PanelHeader />
      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4" aria-live="polite">
        {thread.length === 0 && (
          <span className="text-sm leading-[1.5] text-body">{introFor(ev, context)}</span>
        )}
        {thread.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AiBubble key={m.id} ev={ev} m={m} onAction={talk.runAction} onDecide={talk.decide} />
          ),
        )}
        {busy && <Writing draft={draft} />}
        <div ref={endRef} />
      </div>
      <div className="flex flex-wrap gap-1.5 px-[18px] pb-2">
        {ev.assistant.chips.map((c) => (
          <button key={c} type="button" className="chip chip-sm" disabled={busy} onClick={() => send(c)}>
            {c}
          </button>
        ))}
      </div>
      <Composer
        id={`ask-${ev.id}`}
        text={text}
        onText={setText}
        lang={lang}
        onLang={setLang}
        busy={busy}
        onSend={send}
      />
    </section>
  );
}

function PanelHeader() {
  const ai = useAiOn() === true;
  return (
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
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[88%] self-end rounded-[14px_14px_4px_14px] bg-ink px-3.5 py-2.5 text-sm leading-normal text-paper">
      {text}
    </div>
  );
}

interface AiBubbleProps {
  ev: AnyEvent;
  m: Message;
  onAction: (m: Message) => void;
  onDecide: (m: Message, p: Preview, apply: boolean) => void;
}

/** An answer, with its translation, source, offered action, previewed change or proposals. */
function AiBubble({ ev, m, onAction, onDecide }: AiBubbleProps) {
  const { action, preview } = m;
  return (
    <div className="flex max-w-[94%] flex-col gap-2 text-sm leading-[1.5]">
      <span lang={m.lang} className="whitespace-pre-wrap">
        {m.text}
      </span>
      {m.translation && <span className="text-xs text-muted italic">{m.translation}</span>}
      {m.source && <span className="text-xs leading-[1.4] text-peacock">{m.source}</span>}
      {action && (
        <button
          type="button"
          className="btn btn-sm btn-secondary self-start"
          disabled={action.done}
          onClick={() => onAction(m)}
        >
          {action.done ? `✓ ${action.label.replace(/^Add /, "Added ")}` : action.label}
        </button>
      )}
      {preview && <PreviewCard preview={preview} onDecide={(apply) => onDecide(m, preview, apply)} />}
      {m.proposals && <Proposal ev={ev} m={m} />}
      {m.footnote && <span className="text-xs text-muted">{m.footnote}</span>}
    </div>
  );
}

/** The answer as it streams in, or three dots until the first words arrive. */
function Writing({ draft }: { draft: string }) {
  if (!draft)
    return (
      <span role="status" aria-label="Plannr is thinking" className="py-1">
        <ThinkingDots />
      </span>
    );
  return (
    <div className="flex max-w-[94%] flex-col gap-2 text-sm leading-[1.5]" aria-busy="true">
      <span className="whitespace-pre-wrap">
        {draft}
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-peacock align-middle"
        />
      </span>
    </div>
  );
}

interface ComposerProps {
  id: string;
  text: string;
  onText: (text: string) => void;
  lang: SpeechCode;
  onLang: (lang: SpeechCode) => void;
  busy: boolean;
  onSend: (text: string) => void;
}

/** The question box: typed or spoken, sent with Enter, a new line with Shift+Enter. */
function Composer({ id, text, onText, lang, onLang, busy, onSend }: ComposerProps) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSend(text);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    onSend(text);
  };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t border-line px-[18px] py-3">
      <label htmlFor={id} className="sr-only">
        Ask about this event
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything, or tell me what to change"
        className="resize-none bg-transparent text-sm leading-[1.4] outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-2">
        <HoldToSpeak code={lang} onText={onText} compact />
        <LangSelect value={lang} onChange={onLang} />
        <button type="submit" className="btn btn-primary btn-sm ml-auto" disabled={busy || !text.trim()}>
          Send
        </button>
      </div>
    </form>
  );
}
