import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "../../lib/api";
import type { Busy } from "./types";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;
/** Seconds before another code may be sent. */
const RESEND_SECONDS = 30;
const blankCode = () => Array<string>(CODE_LENGTH).fill("");

/** Seconds until a new code may be sent, counting down while `running`; the function starts it again. */
function useCountdown(running: boolean): [number, () => void] {
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (!running || seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [running, seconds]);
  return [seconds, () => setSeconds(RESEND_SECONDS)];
}

export type Attempt = (step: Busy, run: () => Promise<void>) => Promise<void>;

/** Email sign-in: send a code to an address, then type the code in. */
export function EmailSignIn({
  busy,
  error,
  setError,
  attempt,
  release,
  submitLabel,
  onVerified,
}: {
  busy: Busy;
  error: string;
  setError: (error: string) => void;
  attempt: Attempt;
  /** Ends the busy state after a step that doesn't navigate away. */
  release: () => void;
  submitLabel: string;
  onVerified: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState<string[]>(blankCode);
  const [seconds, restartCountdown] = useCountdown(sent);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const sendCode = () =>
    attempt("send", async () => {
      await api.sendCode(email);
      release();
      setSent(true);
      restartCountdown();
      setCode(blankCode());
      window.setTimeout(() => boxes.current[0]?.focus(), 0);
    });

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (EMAIL.test(email)) void sendCode();
    else setError("Enter an email address like name@example.com.");
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (code.some((d) => !d)) {
      setError("Enter all six digits from the email.");
      return;
    }
    void attempt("verify", async () => {
      await api.verifyCode(email, code.join(""));
      await onVerified();
    });
  };

  if (!sent) return <EmailForm email={email} setEmail={setEmail} error={error} busy={busy} onSubmit={send} />;
  return (
    <CodeForm
      email={email}
      code={code}
      setCode={setCode}
      boxes={boxes}
      seconds={seconds}
      busy={busy}
      submitLabel={submitLabel}
      onChangeEmail={() => {
        setSent(false);
        setError("");
      }}
      onResend={sendCode}
      onSubmit={verify}
    />
  );
}

interface FormProps {
  busy: Busy;
  onSubmit: (e: FormEvent) => void;
}

/** Step one of email sign-in: the address to send a code to. */
function EmailForm({
  email,
  setEmail,
  error,
  busy,
  onSubmit,
}: FormProps & { email: string; setEmail: (email: string) => void; error: string }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          placeholder="priya@example.com"
          className="field"
          aria-invalid={!!error}
          aria-describedby={error ? "auth-error" : undefined}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-lg" disabled={!!busy}>
        {busy === "send" ? "Sending…" : "Email me a code"}
      </button>
    </form>
  );
}

/** Step two of email sign-in: the six-digit code, with a resend once the countdown ends. */
function CodeForm({
  email,
  code,
  setCode,
  boxes,
  seconds,
  busy,
  submitLabel,
  onChangeEmail,
  onResend,
  onSubmit,
}: FormProps & {
  email: string;
  code: string[];
  setCode: (update: (c: string[]) => string[]) => void;
  boxes: RefObject<(HTMLInputElement | null)[]>;
  seconds: number;
  submitLabel: string;
  onChangeEmail: () => void;
  onResend: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <span className="label">Email</span>
        <div className="field gap-2.5">
          <span className="min-w-0 flex-1 truncate">{email}</span>
          <button type="button" className="link text-[13px]" onClick={onChangeEmail}>
            Change
          </button>
        </div>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label mb-2">6-digit code sent by email</legend>
        <CodeBoxes code={code} setCode={setCode} boxes={boxes} />
        <span className="text-[13px] text-muted">
          {seconds > 0 ? (
            <>Resend in 0:{String(seconds).padStart(2, "0")}</>
          ) : (
            <button type="button" className="link" onClick={onResend} disabled={!!busy}>
              Resend code
            </button>
          )}
          {import.meta.env.DEV && " · Running locally: the code is in the server log."}
        </span>
      </fieldset>
      <button type="submit" className="btn btn-primary btn-lg" disabled={!!busy}>
        {busy === "verify" ? "Checking…" : submitLabel}
      </button>
    </form>
  );
}

/**
 * The six code boxes. Typing moves to the next box, Backspace and the arrow keys move back
 * and forth, and pasting the whole code fills every box.
 */
function CodeBoxes({
  code,
  setCode,
  boxes,
}: {
  code: string[];
  setCode: (update: (c: string[]) => string[]) => void;
  boxes: RefObject<(HTMLInputElement | null)[]>;
}) {
  const last = CODE_LENGTH - 1;
  const focus = (i: number) => boxes.current[i]?.focus();

  const setDigit = (i: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((c) => c.map((d, j) => (j === i ? digit : d)));
    if (digit && i < last) focus(i + 1);
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) focus(i - 1);
    if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
    if (e.key === "ArrowRight" && i < last) focus(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!digits) return;
    e.preventDefault();
    setCode(() => Array.from({ length: CODE_LENGTH }, (_, i) => digits[i] ?? ""));
    focus(Math.min(last, digits.length));
  };

  return (
    <div className="flex gap-2">
      {code.map((d, i) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: the six boxes are fixed positions
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          className="h-14 w-12 rounded-[10px] border border-line-2 bg-surface text-center font-serif text-2xl outline-none focus:border-2 focus:border-ink"
        />
      ))}
    </div>
  );
}
