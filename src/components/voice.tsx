import { useEffect, useRef, useState } from "react";
import { listen, SPEECH_LANGS, type SpeechCode, speechSupported } from "../lib/voice";

export function LangSelect({ value, onChange }: { value: SpeechCode; onChange: (c: SpeechCode) => void }) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">Language for voice and replies</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SpeechCode)}
        className="min-h-8 cursor-pointer appearance-none rounded-md bg-sand py-1.5 pr-5 pl-2 font-mono text-xs font-semibold"
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

/**
 * Press and hold to talk; release to stop. Keyboard users press Space or Enter to
 * start and again to stop. The running transcript goes to `onText`.
 */
export function useVoice(code: SpeechCode, onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const supported = speechSupported();
  useEffect(() => () => stopRef.current?.(), []);
  const start = () => {
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
  const stop = () => {
    stopRef.current?.();
  };
  return { listening, error, supported, start, stop };
}

/** What the button says to a screen reader. */
function voiceLabel(v: { supported: boolean; listening: boolean }): string {
  if (!v.supported) return "Voice input isn't available in this browser";
  return v.listening ? "Listening, release to stop" : "Hold to speak";
}

export function HoldToSpeak({
  code,
  onText,
  compact,
}: {
  code: SpeechCode;
  onText: (t: string) => void;
  compact?: boolean;
}) {
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
        <span role="alert" className="text-xs text-rust-ink">
          {v.error}
        </span>
      )}
    </>
  );
}

export function MicGlyph() {
  return <span aria-hidden="true" className="block h-3.5 w-2 rounded-[4px] border-2 border-ink" />;
}

export function Waveform({ label }: { label: string }) {
  const bars = [8, 18, 26, 14, 22, 10, 20];
  return (
    <div aria-hidden="true" className="flex h-7 flex-1 items-center gap-[3px]">
      {bars.map((h, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: decorative bars
          key={i}
          className="w-[3px] rounded-sm bg-peacock"
          style={{ height: h, animation: `wave 0.9s ease-in-out ${i * 0.08}s infinite` }}
        />
      ))}
      <span className="ml-2 text-[13px] font-medium text-peacock">{label}</span>
    </div>
  );
}
