import { useRef, useState } from "react";
import { HoldToSpeak, LangSelect } from "../../components/voice";
import type { SpeechCode } from "../../lib/voice";

/** The composer's placeholder: an example to start, then plain prompts. */
function composerHint(ready: boolean, answered: boolean): string {
  if (ready) return "Add anything else, or press Draft my plan";
  return answered ? "Type your answer" : "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December";
}

interface ComposerProps {
  ready: boolean;
  thinking: boolean;
  answered: boolean;
  onSend: (text: string) => Promise<void>;
  onImages: (files: FileList | null) => void;
  onDraft: () => void;
}

/** Where the family types or speaks, adds inspiration images, and asks for the draft. */
export function Composer({ ready, thinking, answered, onSend, onImages, onDraft }: ComposerProps) {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<SpeechCode>("EN");
  const fileRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    if (!text.trim() || thinking) return;
    void onSend(text);
    setText("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
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
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey) return;
          e.preventDefault();
          submit();
        }}
        placeholder={composerHint(ready, answered)}
        className="resize-none bg-transparent text-base leading-[1.4] outline-none placeholder:text-muted"
      />
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onImages(e.target.files)}
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
          <button type="button" className="btn btn-primary" disabled={!ready || thinking} onClick={onDraft}>
            Draft my plan
          </button>
        </div>
      </div>
    </form>
  );
}
