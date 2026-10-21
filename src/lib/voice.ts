/** Browser speech recognition, used for "Hold to speak". Chrome and Edge ship it; Firefox does not. */

export const SPEECH_LANGS = [
  { code: "EN", lang: "en-IN", label: "English" },
  { code: "ML", lang: "ml-IN", label: "മലയാളം" },
  { code: "HI", lang: "hi-IN", label: "हिन्दी" },
  { code: "TA", lang: "ta-IN", label: "தமிழ்" },
  { code: "KN", lang: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "TE", lang: "te-IN", label: "తెలుగు" },
] as const;

export type SpeechCode = (typeof SPEECH_LANGS)[number]["code"];

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speechSupported(): boolean {
  return !!ctor();
}

export function langFor(code: SpeechCode): string {
  return SPEECH_LANGS.find((l) => l.code === code)?.lang ?? "en-IN";
}

/** Starts listening; returns a stop function. `onText` receives the running transcript. */
export function listen(
  code: SpeechCode,
  onText: (text: string) => void,
  onEnd: (error?: string) => void,
): () => void {
  const Ctor = ctor();
  if (!Ctor) {
    onEnd("unsupported");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = langFor(code);
  rec.interimResults = true;
  rec.continuous = true;
  let text = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (!r) continue;
      if (r.isFinal) text += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText((text + interim).trim());
  };
  rec.onerror = (e) => onEnd(e.error);
  rec.onend = () => onEnd();
  rec.start();
  return () => rec.stop();
}
