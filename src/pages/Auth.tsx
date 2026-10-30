import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { saveHint } from "../components/shell";
import { Kolam, Logo, Spinner, Toran, usePageMeta } from "../components/ui";
import type { Profile } from "../data/types";
import { ApiError, api } from "../lib/api";
import { longDate } from "../lib/dates";
import { inr } from "../lib/format";
import { draftPlan, type PlanDraft } from "../lib/plan";
import type { AccountUser, SignInMethods } from "../shared/types";
import { useAccount } from "../store/account";
import { type AppState, toast, useStore } from "../store/store";

type Busy = "" | "google" | "send" | "verify" | "guest";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A sign-in error in words a family member can act on. */
function codeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again.";
  if (e.status === 0) return e.message;
  if (e.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (/expired/i.test(e.message)) return "That code has expired. Send a new one.";
  if (/invalid|otp/i.test(e.message)) return "That code doesn't match. Check the latest email from Plannr.";
  return e.message;
}

type Mode = "signup" | "signin";
/** A guest adding an email or Google keeps every plan; the server moves them across. */
type Variant = Mode | "upgrade";

const COPY: Record<Variant, { title: string; lead: string; heading: string; verify: string }> = {
  upgrade: {
    title: "Save your plans",
    lead: "Sign in and your plans follow you to every device.",
    heading: "Keep your plans safe",
    verify: "Verify and keep my plans",
  },
  signup: {
    title: "Create your account",
    lead: "Save your plan so the whole family can work on it.",
    heading: "Create your account",
    verify: "Verify and continue",
  },
  signin: {
    title: "Log in",
    lead: "Welcome back. Your events are where you left them.",
    heading: "Log in to Plannr",
    verify: "Verify and log in",
  },
};

const INTRO: Record<Mode, string> = {
  signup:
    "Describe an event once, then plan it with family, co-planners and volunteers. Everyone sees the same plan, and every change can be undone.",
  signin: "Budgets, tasks, vendors and guests for every event you plan, in one place.",
};

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;
const ACCEPT_DRAFT = "/new/generating?accept=1";
const blankCode = () => Array<string>(CODE_LENGTH).fill("");

/** A guest signing in properly is upgrading: their plans come with them. */
function variantFor(state: AppState, mode: Mode): Variant {
  const guest = state.mode === "account" && !!state.account.user?.isAnonymous;
  return guest ? "upgrade" : mode;
}

const hasAnyMethod = (m: SignInMethods) => m.guest || m.email || m.google;
const firstName = (user: AccountUser) => user.name.split(/\s+/)[0];

/** A guest, or an account without a name, is asked for a name before anything else. */
const needsName = (user: AccountUser) => user.isAnonymous || !user.name.trim();

/** Where Google sends them back to: their destination, onboarding for a new account, or this form on error. */
function googleCallbacks(mode: Mode, next: string | null, query: string) {
  return {
    callbackURL: destination(next),
    newUserCallbackURL: `/onboarding${query}`,
    errorCallbackURL: `/${mode}${query ? `${query}&` : "?"}error=google`,
  };
}

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

/** Where to go once signed in: accepting a draft, a page they were headed to, or their events. */
function destination(next: string | null): string {
  if (next === "accept") return ACCEPT_DRAFT;
  return next?.startsWith("/") ? next : "/events";
}

export function Auth({ mode }: { mode: Mode }) {
  const signup = mode === "signup";
  const { state, dispatch } = useStore();
  const { signedIn } = useAccount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const methods = state.account.methods;
  const variant = variantFor(state, mode);
  const upgrading = variant === "upgrade";
  const copy = COPY[variant];
  usePageMeta(copy.title, { private: true });
  const draft = state.draft;
  const plan = draft.generated ? draftPlan(draft.profile) : undefined;

  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState(params.get("error") ? "Google sign-in didn't finish. Try again." : "");
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  /** Where to go once signed in: a name first if we don't have one, then wherever they were headed. */
  const finish = (user: AccountUser | null) => {
    if (!user) {
      setBusy("");
      setError("You're signed in, but we couldn't load your account. Refresh the page.");
      return;
    }
    if (needsName(user)) {
      navigate(`/onboarding${query}`);
      return;
    }
    dispatch(toast(`Welcome${signup ? "" : " back"}, ${firstName(user)}.`));
    navigate(destination(next));
  };

  /** Runs one sign-in step, showing its error in the form if it fails. Success usually navigates away. */
  const attempt: Attempt = async (step, run) => {
    setBusy(step);
    setError("");
    try {
      await run();
    } catch (e) {
      setBusy("");
      setError(codeError(e));
    }
  };

  const google = () =>
    attempt("google", async () => {
      const { url } = await api.google(googleCallbacks(mode, next, query));
      window.location.assign(url);
    });

  const guest = () =>
    attempt("guest", async () => {
      await api.signInGuest();
      finish(await signedIn());
    });

  const demo = () => {
    dispatch({ type: "enterDemo" });
    navigate(next === "accept" ? ACCEPT_DRAFT : "/events");
  };

  const accountsOff = methods && !hasAnyMethod(methods);
  const verifyLabel = variant === "signup" && plan ? "Verify and save plan" : copy.verify;

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[480px_minmax(0,1fr)]">
      <AuthAside lead={copy.lead} intro={INTRO[mode]} plan={plan} profile={draft.profile} />

      <main id="main" className="flex flex-col justify-center gap-5 px-5 py-12 sm:px-[72px]">
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
          <h2 className="font-serif text-[34px] leading-[1.1]">{copy.heading}</h2>

          {!methods && (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner label="Checking sign-in options" />
            </div>
          )}
          {accountsOff && <AccountsOff onDemo={demo} />}
          {methods && !accountsOff && (
            <>
              {methods.google && <GoogleButton busy={busy} onClick={google} />}
              {methods.google && methods.email && <Divider />}

              {methods.email && (
                <EmailSignIn
                  busy={busy}
                  error={error}
                  setError={setError}
                  attempt={attempt}
                  release={() => setBusy("")}
                  submitLabel={verifyLabel}
                  onVerified={async () => finish(await signedIn())}
                />
              )}

              <FormError error={error} />

              {methods.guest && !upgrading && <GuestOption methods={methods} busy={busy} onGuest={guest} />}
            </>
          )}

          <AuthFooter
            variant={variant}
            query={query}
            onDemo={!upgrading && !accountsOff ? demo : undefined}
          />
        </div>
      </main>
    </div>
  );
}

/** The maroon side panel: what signing in gets them, and the draft that's waiting if there is one. */
function AuthAside({
  lead,
  intro,
  plan,
  profile,
}: {
  lead: string;
  intro: string;
  plan: PlanDraft | undefined;
  profile: Profile;
}) {
  return (
    <aside className="on-dark relative flex flex-col justify-between gap-10 overflow-hidden bg-maroon p-6 text-cream sm:p-10">
      <Kolam className="kolam" />
      <Toran size="md" className="absolute inset-x-0 top-0" />
      <div className="relative mt-4">
        <Logo size={30} tone="light" to="/" />
      </div>
      <div className="relative flex flex-col gap-[18px]">
        <h1 className="font-serif text-[clamp(32px,4vw,44px)] leading-[1.08] tracking-[-0.015em] text-white">
          {lead}
        </h1>
        {plan ? (
          <DraftWaiting plan={plan} profile={profile} />
        ) : (
          <p className="m-0 max-w-[380px] text-[15px] leading-normal text-gold-soft">{intro}</p>
        )}
      </div>
      <span className="relative text-[13px] leading-[1.4] text-gold-soft">
        Free for one event. No card needed.
      </span>
    </aside>
  );
}

function GoogleButton({ busy, onClick }: { busy: Busy; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-lg w-full border-line-2"
      onClick={onClick}
      disabled={!!busy}
    >
      <GoogleMark />
      {busy === "google" ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

/** The form's error, announced as it appears. The email field points at it with aria-describedby. */
function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p id="auth-error" role="alert" className="m-0 text-[13px] font-medium text-rust-ink">
      {error}
    </p>
  );
}

/** The switch between forms, and the way into the demo when it's offered. */
function AuthFooter({ variant, query, onDemo }: { variant: Variant; query: string; onDemo?: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm text-body">
      <SwitchLink variant={variant} query={query} />
      {onDemo && (
        <span>
          Just looking?{" "}
          <button type="button" className="link" onClick={onDemo}>
            Explore the demo
          </button>{" "}
          with sample events. It stays in this browser.
        </span>
      )}
    </div>
  );
}

/** The draft made before signing up, so they know it's kept. */
function DraftWaiting({ plan, profile }: { plan: PlanDraft; profile: Profile }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[rgba(241,217,166,.35)] bg-[rgba(31,27,22,.25)] p-4 text-sm leading-[1.45]">
      <span className="eyebrow text-gold-soft">Your draft, waiting</span>
      <span>
        {plan.title.charAt(0).toUpperCase() + plan.title.slice(1)}
        {profile.city ? ` · ${profile.city}` : ""}
        {profile.date ? ` · ${longDate(profile.date)}` : ""}
      </span>
      <span className="text-gold-soft">
        {inr(plan.budget.total)} across {plan.budget.lines.length} categories · {plan.tasks} tasks ·{" "}
        {plan.vendors.length} vendors to book
      </span>
    </div>
  );
}

/** A copy of Plannr with no sign-in method configured: the demo still works. */
function AccountsOff({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <p className="m-0 text-[15px] leading-normal text-body">
        Accounts aren't switched on for this copy of Plannr yet, so plans can't be saved online. You can still
        try everything with demo data. It stays in this browser.
      </p>
      <button type="button" className="btn btn-primary btn-lg" onClick={onDemo}>
        Explore the demo
      </button>
    </div>
  );
}

type Attempt = (step: Busy, run: () => Promise<void>) => Promise<void>;

/** Email sign-in: send a code to an address, then type the code in. */
function EmailSignIn({
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

/** Start without signing up; the plans are saved online for this browser. */
function GuestOption({
  methods,
  busy,
  onGuest,
}: {
  methods: SignInMethods;
  busy: Busy;
  onGuest: () => void;
}) {
  return (
    <>
      <Divider />
      <div className="flex flex-col gap-2">
        <button type="button" className="btn btn-outline btn-lg w-full" onClick={onGuest} disabled={!!busy}>
          {busy === "guest" ? "Setting things up…" : "Continue as a guest"}
        </button>
        <span className="text-[13px] leading-[1.4] text-muted">
          Nothing to sign up for. Your plans are saved online for this browser. {saveHint(methods)} any time
          to use them on your phone too.
        </span>
      </div>
    </>
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

/** The way to the other form, or back to their events for a guest who isn't upgrading yet. */
function SwitchLink({ variant, query }: { variant: Variant; query: string }) {
  if (variant === "upgrade")
    return (
      <Link to="/events" className="link">
        Not now, back to my events
      </Link>
    );
  if (variant === "signup")
    return (
      <span>
        Already have an account?{" "}
        <Link to={`/signin${query}`} className="link">
          Log in
        </Link>
      </span>
    );
  return (
    <span>
      New to Plannr?{" "}
      <Link to={`/signup${query}`} className="link">
        Create an account
      </Link>
    </span>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-3.9 7-9.7 7-17.1z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
