import type { JSX } from "react";
import { PriorityPicker } from "../../components/intake";
import { ThinkingDots } from "../../components/ui";
import type { Profile } from "../../data/types";
import type { Question } from "../../lib/intakeQuestions";
import type { ChatTurn, Draft } from "../../store/types";
import { KIND_FROM_CHIP } from "./conversation";
import { AiMark } from "./ProfilePanel";

/** The two ranked lists in the intake: what matters most, and what can go. */
export type PriorityList = "priorities" | "cuts";

interface TurnHandlers {
  onPick: (q: Question, option: string) => void;
  onToggle: (option: string, list: PriorityList) => void;
}

/** The intake chat: every turn so far, the chips for the current question, and Plannr thinking. */
export function Thread({
  draft,
  thinking,
  onPick,
  onToggle,
}: { draft: Draft; thinking: boolean } & TurnHandlers): JSX.Element {
  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      {draft.chat.map((t, i) =>
        t.role === "user" ? (
          <div
            key={t.id}
            className="rise max-w-[86%] self-end whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-ink px-[18px] py-3.5 text-base text-paper leading-normal sm:max-w-[76%]"
          >
            {t.text}
          </div>
        ) : (
          <AiTurn
            key={t.id}
            turn={t}
            profile={draft.profile}
            live={i === draft.chat.length - 1}
            onPick={onPick}
            onToggle={onToggle}
          />
        ),
      )}
      {thinking && <Thinking />}
    </div>
  );
}

function AiTurn({
  turn,
  profile,
  live,
  onPick,
  onToggle,
}: { turn: ChatTurn; profile: Profile; live: boolean } & TurnHandlers) {
  const q = turn.question;
  return (
    <div className="rise flex max-w-full gap-3 sm:max-w-[88%]">
      <AiMark />
      <div className="flex min-w-0 flex-col gap-3 text-base leading-[1.55]">
        {turn.text && <span>{turn.text}</span>}
        {q && <span className="font-semibold">{q.prompt}</span>}
        {q?.options && <Chips question={q} profile={profile} live={live} onPick={onPick} />}
        {q?.field === "priorities" && <PriorityPicker profile={profile} onToggle={onToggle} />}
      </div>
    </div>
  );
}

/** The quick answers under a question. Once the conversation moves on, only the chosen one stays lit. */
function Chips({
  question,
  profile,
  live,
  onPick,
}: { question: Question; profile: Profile; live: boolean } & Pick<TurnHandlers, "onPick">) {
  return (
    <div className="flex flex-wrap gap-2">
      {question.options?.map((o) => {
        const on =
          (question.field === "venue" && profile.venueStatus === o) ||
          (question.field === "kind" && profile.kind === KIND_FROM_CHIP[o]);
        return (
          <button
            key={o}
            type="button"
            disabled={!live && !on}
            aria-pressed={on}
            onClick={() => onPick(question, o)}
            className={`inline-flex min-h-9 items-center rounded-full border px-[13px] font-medium text-sm ${on ? "border-peacock bg-peacock-tint text-peacock" : "border-line text-muted hover:border-line-2 hover:text-ink disabled:hover:border-line disabled:hover:text-muted"}`}
          >
            {on ? `✓ ${o}` : o}
          </button>
        );
      })}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-3" role="status" aria-label="Plannr is thinking">
      <AiMark />
      <ThinkingDots />
    </div>
  );
}
