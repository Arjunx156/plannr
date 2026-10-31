import { type JSX, useEffect, useRef, useState } from "react";
import { listen, SPEECH_LANGS, type SpeechCode, speechSupported } from "../lib/voice";

/** Picks the language for voice input and Plannr's replies. */
export function LangSelect({
  value,
  onChange,
}: {
  value: SpeechCode;
  onChange: (c: SpeechCode) => void;
}): JSX.Element {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">Language for voice and replies</span>
      <select
        value={value}
        onChange={(e) => {
          const lang = SPEECH_LANGS.find((l) => l.code === e.target.value);
          if (lang) onChange(lang.code);
        }}
        className="min-h-8 cursor-pointer appearance-none rounded-md bg-sand py-1.5 pr-5 pl-2 font-mono font-semibold text-xs"
      >
        {SPEECH_LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code} · {l.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[9px]"
      >
        ▾
      </span>
    </label>
  );
}

/** A microphone the browser may or may not have, and what it is doing now. */
export interface Voice {
  listening: boolean;
  /** Why listening stopped early, in words for the person; empty when all is well. */
  error: string;
  supported: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Press and hold to talk; release to stop. Keyboard users press Space or Enter to
 * start and again to stop. The running transcript goes to `onText`.
 */
export function useVoice(code: SpeechCode, onText: (t: string) => void): Voice {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const supported = speechSupported();
  useEffect(() => () => stopRef.current?.(), []);
  const start = (): void => {
    if (!supported || listening) return;
    setError("");
    setListening(true);
    stopRef.current = listen(code, onText, (err) => {
      setListening(false);
      stopRef.current = null;
      if (err && err !== "aborted" && err !== "no-speech")
        setError(
          err === "not-allowed"
            ? "Microphone access is blocked for this site."
            : "Voice input stopped. Try again.",
        );
    });
  };
  const stop = (): void => {
    stopRef.current?.();
  };
  return { listening, error, supported, start, stop };
}

/** What the button says to a screen reader. */
function voiceLabel(v: { supported: boolean; listening: boolean }): string {
  if (!v.supported) return "Voice input isn't available in this browser";
  return v.listening ? "Listening, release to stop" : "Hold to speak";
}

/** A button to hold while speaking; the transcript goes to `onText`. */
export function HoldToSpeak({
  code,
  onText,
  compact,
}: {
  code: SpeechCode;
  onText: (t: string) => void;
  compact?: boolean;
}): JSX.Element {
  const v = useVoice(code, onText);
  const label = voiceLabel(v);
  const words = v.listening ? "Listening…" : "Hold to speak";
  return (
    <>
      <button
        type="button"
        disabled={!v.supported}
        title={label}
        aria-label={compact ? label : undefined}
        aria-pressed={v.listening}
        onPointerDown={(e) => {
          e.preventDefault();
          v.start();
        }}
        onPointerUp={v.stop}
        onPointerLeave={() => v.listening && v.stop()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (v.listening) v.stop();
            else v.start();
          }
        }}
        className={
          compact
            ? `inline-flex h-8 w-8 items-center justify-center rounded-lg border ${v.listening ? "border-peacock bg-peacock-tint" : "border-line"} disabled:opacity-40`
            : `btn btn-sm ${v.listening ? "border-peacock bg-peacock-tint text-peacock" : "border-line bg-transparent"} font-medium`
        }
      >
        {compact ? <MicGlyph /> : words}
      </button>
      {v.error && (
        <span role="alert" className="text-rust-ink text-xs">
          {v.error}
        </span>
      )}
    </>
  );
}

/** A small microphone shape. */
export function MicGlyph(): JSX.Element {
  return <span aria-hidden="true" className="block h-3.5 w-2 rounded-[4px] border-2 border-ink" />;
}

// Uneven heights, each starting a beat after the last, read as a voice.
const WAVE_BARS = [
  "h-[8px] [animation-delay:0s]",
  "h-[18px] [animation-delay:0.08s]",
  "h-[26px] [animation-delay:0.16s]",
  "h-[14px] [animation-delay:0.24s]",
  "h-[22px] [animation-delay:0.32s]",
  "h-[10px] [animation-delay:0.4s]",
  "h-[20px] [animation-delay:0.48s]",
];

/** Moving bars that show Plannr is listening. */
export function Waveform({ label }: { label: string }): JSX.Element {
  return (
    <div aria-hidden="true" className="flex h-7 flex-1 items-center gap-[3px]">
      {WAVE_BARS.map((bar) => (
        <span
          key={bar}
          className={`w-[3px] animate-[wave_0.9s_ease-in-out_infinite] rounded-sm bg-peacock ${bar}`}
        />
      ))}
      <span className="ml-2 font-medium text-[13px] text-peacock">{label}</span>
    </div>
  );
}
