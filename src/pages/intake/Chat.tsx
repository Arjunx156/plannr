import { type RefObject, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { canDraft, type ImagePreview, imagesFrom } from "../../components/intake";
import type { Profile } from "../../data/types";
import { extractWithAi, mergeAiProfile } from "../../lib/aiIntake";
import { type Question, togglePick } from "../../lib/intakeQuestions";
import { useStore } from "../../store/store";
import type { ChatTurn, Draft } from "../../store/types";
import { Composer } from "./Composer";
import {
  askedAfter,
  DONE,
  greetingFor,
  KIND_FROM_CHIP,
  leadFor,
  pendingField,
  questionAfter,
  readAnswer,
  turnId,
} from "./conversation";
import { ProfilePanel } from "./ProfilePanel";
import { type PriorityList, Thread } from "./Thread";

/** Plannr pauses this long before replying, so an instant answer doesn't read as canned. */
const REPLY_PAUSE_MS = 650;

/** The profile after a chip is picked, and the turn Plannr answers with. */
function chipAnswer(current: Draft, q: Question, option: string) {
  if (q.field === "venue") {
    const profile = { ...current.profile, venueStatus: option as Profile["venueStatus"] };
    const asked = [...new Set([...current.asked, "venue" as const])];
    const next = questionAfter(profile, asked, "venue");
    const reply: ChatTurn = { id: turnId(), role: "ai", text: next ? "" : DONE, question: next ?? undefined };
    return { patch: { profile, asked }, reply };
  }
  if (q.field === "kind") {
    const profile = { ...current.profile, kind: KIND_FROM_CHIP[option] ?? "other" };
    const next = questionAfter(profile, current.asked);
    const reply: ChatTurn = { id: turnId(), role: "ai", text: "", question: next ?? undefined };
    return { patch: { profile }, reply };
  }
  return undefined;
}

/** Sending messages and picking answers, with Plannr's reply after a short pause. */
function useReplies(draftRef: RefObject<Draft>) {
  const { dispatch } = useStore();
  const [thinking, setThinking] = useState(false);

  const respond = (reply: ChatTurn) => {
    setThinking(true);
    window.setTimeout(() => {
      dispatch({ type: "draft", patch: { chat: [...draftRef.current.chat, reply] } });
      setThinking(false);
    }, REPLY_PAUSE_MS);
  };

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || thinking) return;
    const current = draftRef.current;
    const field = pendingField(current);
    const isFirst = !current.chat.some((t) => t.role === "user");
    // The on-device parse lands instantly; Gemini fills what it missed a moment later.
    const local = readAnswer(message, current.profile, field);
    const asked = askedAfter(current.asked, field);
    const userTurn: ChatTurn = { id: turnId(), role: "user", text: message };
    dispatch({ type: "draft", patch: { profile: local, asked, chat: [...current.chat, userTurn] } });
    setThinking(true);
    const started = Date.now();
    const ai = await extractWithAi(message, current.profile, field);
    const next = mergeAiProfile(local, ai);
    const q = questionAfter(next, asked, field);
    const lead = leadFor({ field, isFirst, aiReply: ai?.reply, prev: current.profile, next, question: q });
    await new Promise((r) => window.setTimeout(r, Math.max(0, REPLY_PAUSE_MS - (Date.now() - started))));
    const aiTurn: ChatTurn = { id: turnId(), role: "ai", text: lead, question: q ?? undefined };
    dispatch({ type: "draft", patch: { profile: next, chat: [...draftRef.current.chat, aiTurn] } });
    setThinking(false);
  };

  const pick = (q: Question, option: string) => {
    const answer = chipAnswer(draftRef.current, q, option);
    if (!answer) return;
    dispatch({ type: "draft", patch: answer.patch });
    respond(answer.reply);
  };

  const togglePriority = (option: string, list: PriorityList) => {
    const { profile, asked } = draftRef.current;
    dispatch({
      type: "draft",
      patch: {
        profile: { ...profile, [list]: togglePick(profile[list], option, list) },
        asked: [...new Set([...asked, "priorities" as const])],
      },
    });
  };

  return { thinking, send, pick, togglePriority };
}

/** The conversation that builds the event's profile, with the profile so far beside it. */
export function Chat({ draft, autoSend, onEdit }: { draft: Draft; autoSend?: string; onEdit: () => void }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const [images, setImages] = useState<ImagePreview[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sentAuto = useRef(false);
  const { thinking, send, pick, togglePriority } = useReplies(draftRef);
  const p = draft.profile;
  const last = draft.chat.at(-1);

  useEffect(() => {
    if (draft.chat.length > 0) return;
    const greeting = greetingFor(p.kind, p.names);
    dispatch({ type: "draft", patch: { chat: [{ id: turnId(), role: "ai", text: greeting }] } });
  }, [draft.chat.length, p.kind, p.names, dispatch]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the conversation grows
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [draft.chat.length, thinking]);

  useEffect(() => {
    if (autoSend && !sentAuto.current && draft.chat.length === 1 && draft.chat[0]?.role === "ai") {
      sentAuto.current = true;
      void send(autoSend);
    }
  });

  const addImages = (files: FileList | null) => {
    const added = imagesFrom(files);
    if (added.length === 0) return;
    setImages((imgs) => [...imgs, ...added]);
    const profile = draftRef.current.profile;
    const inspiration = [...profile.inspiration, ...added.map((a) => a.name)];
    dispatch({ type: "draft", patch: { profile: { ...profile, inspiration } } });
  };

  const draftPlan = () => {
    dispatch({ type: "draft", patch: { generated: false } });
    void navigate("/new/generating");
  };

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-5 px-4 pt-7 pb-6 sm:px-10 xl:pr-20 xl:pl-[120px]">
        <Thread draft={draft} thinking={thinking} onPick={pick} onToggle={togglePriority} />
        <Composer
          ready={canDraft(p)}
          thinking={thinking}
          answered={draft.chat.some((t) => t.role === "user")}
          onSend={send}
          onImages={addImages}
          onDraft={draftPlan}
        />
        <div ref={endRef} />
      </div>
      <ProfilePanel
        profile={p}
        asking={last?.role === "ai" ? last.question?.field : undefined}
        images={images}
        onAdd={addImages}
        onEdit={onEdit}
      />
    </div>
  );
}
