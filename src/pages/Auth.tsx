import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { saveHint } from "../components/shell";
import { Kolam, Logo, Spinner, Toran, usePageMeta } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { longDate } from "../lib/dates";
import { inr } from "../lib/format";
import { draftPlan } from "../lib/plan";
import type { AccountUser } from "../shared/types";
import { useAccount } from "../store/account";
import { toast, useStore } from "../store/store";

type Busy = "" | "google" | "send" | "verify" | "guest";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function codeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again.";
  if (e.status === 0) return e.message;
  if (e.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (/expired/i.test(e.message)) return "That code has expired. Send a new one.";
  if (/invalid|otp/i.test(e.message)) return "That code doesn't match. Check the latest email from Plannr.";
  return e.message;
}

export function Auth({ mode }: { mode: "signup" | "signin" }) {
  const signup = mode === "signup";
  const { state, dispatch } = useStore();
  const { signedIn } = useAccount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const methods = state.account.methods;
  // A guest adding an email or Google keeps every plan; the server moves them across.
  const upgrading = state.mode === "account" && !!state.account.user?.isAnonymous;
  usePageMeta(upgrading ? "Save your plans" : signup ? "Create your account" : "Log in", { private: true });
  const draft = state.draft;
  const plan = draft.generated ? draftPlan(draft.profile) : undefined;

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState(params.get("error") ? "Google sign-in didn't finish. Try again." : "");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [seconds, setSeconds] = useState(30);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!sent || seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [sent, seconds]);

  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  /** Where to go once signed in: a name first if we don't have one, then wherever they were headed. */
  const finish = (user: AccountUser | null) => {
    if (!user) {
      setBusy("");
      setError("You're signed in, but we couldn't load your account. Refresh the page.");
      return;
    }
    if (user.isAnonymous || !user.name.trim()) {
      navigate(`/onboarding${query}`);
      return;
    }
    dispatch(toast(`Welcome${signup ? "" : " back"}, ${user.name.split(/\s+/)[0]}.`));
    if (next === "accept") navigate("/new/generating?accept=1");
    else navigate(next?.startsWith("/") ? next : "/events");
  };

  const fail = (e: unknown) => {
    setBusy("");
    setError(codeError(e));
  };

  const google = async () => {
    setBusy("google");
    setError("");
    try {
      const back = next === "accept" ? "/new/generating?accept=1" : next?.startsWith("/") ? next : "/events";
      const { url } = await api.google({
        callbackURL: back,
        newUserCallbackURL: `/onboarding${query}`,
        errorCallbackURL: `/${mode}${query ? `${query}&` : "?"}error=google`,
      });
      window.location.assign(url);
    } catch (e) {
      fail(e);
    }
  };

  const guest = async () => {
    setBusy("guest");
    setError("");
    try {
      await api.signInGuest();
      finish(await signedIn());
    } catch (e) {
      fail(e);
    }
  };

  const sendCode = async () => {
    setBusy("send");
    try {
      await api.sendCode(email);
      setBusy("");
      setSent(true);
      setSeconds(30);
      setCode(Array(6).fill(""));
      window.setTimeout(() => boxes.current[0]?.focus(), 0);
    } catch (e) {
      fail(e);
    }
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email)) {
      setError("Enter an email address like name@example.com.");
      return;
    }
    setError("");
    void sendCode();
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (code.some((d) => !d)) {
      setError("Enter all six digits from the email.");
      return;
    }
    setBusy("verify");
    setError("");
    try {
      await api.verifyCode(email, code.join(""));
      finish(await signedIn());
    } catch (err) {
      fail(err);
    }
  };

  const demo = () => {
    dispatch({ type: "enterDemo" });
    if (next === "accept") navigate("/new/generating?accept=1");
    else navigate("/events");
  };

  const setDigit = (i: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((c) => c.map((d, j) => (j === i ? digit : d)));
    if (digit && i < 5) boxes.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) boxes.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    setCode(Array.from({ length: 6 }, (_, i) => digits[i] ?? ""));
    boxes.current[Math.min(5, digits.length)]?.focus();
  };

  const accountsOff = methods && !methods.guest && !methods.email && !methods.google;

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[480px_minmax(0,1fr)]">
      <aside className="on-dark relative flex flex-col justify-between gap-10 overflow-hidden bg-maroon p-6 text-cream sm:p-10">
        <Kolam className="kolam" />
        <Toran size="md" className="absolute inset-x-0 top-0" />
        <div className="relative mt-4">
          <Logo size={30} tone="light" to="/" />
        </div>
        <div className="relative flex flex-col gap-[18px]">
          <h1 className="font-serif text-[clamp(32px,4vw,44px)] leading-[1.08] tracking-[-0.015em] text-white">
            {upgrading
              ? "Sign in and your plans follow you to every device."
              : signup
                ? "Save your plan so the whole family can work on it."
                : "Welcome back. Your events are where you left them."}
          </h1>
          {plan ? (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[rgba(241,217,166,.35)] bg-[rgba(31,27,22,.25)] p-4 text-sm leading-[1.45]">
              <span className="eyebrow text-gold-soft">Your draft, waiting</span>
              <span>
                {plan.title.charAt(0).toUpperCase() + plan.title.slice(1)}
                {draft.profile.city ? ` · ${draft.profile.city}` : ""}
                {draft.profile.date ? ` · ${longDate(draft.profile.date)}` : ""}
              </span>
              <span className="text-gold-soft">
                {inr(plan.budget.total)} across {plan.budget.lines.length} categories · {plan.tasks} tasks ·{" "}
                {plan.vendors.length} vendors to book
              </span>
            </div>
          ) : (
            <p className="m-0 max-w-[380px] text-[15px] leading-normal text-gold-soft">
              {signup
                ? "Describe an event once, then plan it with family, co-planners and volunteers. Everyone sees the same plan, and every change can be undone."
                : "Budgets, tasks, vendors and guests for every event you plan, in one place."}
            </p>
          )}
        </div>
        <span className="relative text-[13px] leading-[1.4] text-gold-soft">
          Free for one event. No card needed.
        </span>
      </aside>

      <main className="flex flex-col justify-center gap-5 px-5 py-12 sm:px-[72px]">
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-5">
          <h2 className="font-serif text-[34px] leading-[1.1]">
            {upgrading ? "Keep your plans safe" : signup ? "Create your account" : "Log in to Plannr"}
          </h2>

          {!methods ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner label="Checking sign-in options" />
            </div>
          ) : accountsOff ? (
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
              <p className="m-0 text-[15px] leading-normal text-body">
                Accounts aren't switched on for this copy of Plannr yet, so plans can't be saved online. You
                can still try everything with demo data. It stays in this browser.
              </p>
              <button type="button" className="btn btn-primary btn-lg" onClick={demo}>
                Explore the demo
              </button>
            </div>
          ) : (
            <>
              {methods.google && (
                <button
                  type="button"
                  className="btn btn-secondary btn-lg w-full border-line-2"
                  onClick={google}
                  disabled={!!busy}
                >
                  <GoogleMark />
                  {busy === "google" ? "Opening Google…" : "Continue with Google"}
                </button>
              )}
              {methods.google && methods.email && <Divider />}

              {methods.email &&
                (!sent ? (
                  <form onSubmit={send} className="flex flex-col gap-4" noValidate>
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
                ) : (
                  <form onSubmit={verify} className="flex flex-col gap-5" noValidate>
                    <div className="flex flex-col gap-1.5">
                      <span className="label">Email</span>
                      <div className="field gap-2.5">
                        <span className="min-w-0 flex-1 truncate">{email}</span>
                        <button
                          type="button"
                          className="link text-[13px]"
                          onClick={() => {
                            setSent(false);
                            setError("");
                          }}
                        >
                          Change
                        </button>
                      </div>
                    </div>
                    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                      <legend className="label mb-2">6-digit code sent by email</legend>
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
                      <span className="text-[13px] text-muted">
                        {seconds > 0 ? (
                          <>Resend in 0:{String(seconds).padStart(2, "0")}</>
                        ) : (
                          <button type="button" className="link" onClick={sendCode} disabled={!!busy}>
                            Resend code
                          </button>
                        )}
                        {import.meta.env.DEV && " · Running locally: the code is in the server log."}
                      </span>
                    </fieldset>
                    <button type="submit" className="btn btn-primary btn-lg" disabled={!!busy}>
                      {busy === "verify"
                        ? "Checking…"
                        : upgrading
                          ? "Verify and keep my plans"
                          : signup
                            ? plan
                              ? "Verify and save plan"
                              : "Verify and continue"
                            : "Verify and log in"}
                    </button>
                  </form>
                ))}

              {error && (
                <p id="auth-error" role="alert" className="m-0 text-[13px] font-medium text-rust-ink">
                  {error}
                </p>
              )}

              {methods.guest && !upgrading && (
                <>
                  <Divider />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-lg w-full"
                      onClick={guest}
                      disabled={!!busy}
                    >
                      {busy === "guest" ? "Setting things up…" : "Continue as a guest"}
                    </button>
                    <span className="text-[13px] leading-[1.4] text-muted">
                      Nothing to sign up for. Your plans are saved online for this browser.{" "}
                      {saveHint(methods)} any time to use them on your phone too.
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm text-body">
            {upgrading ? (
              <Link to="/events" className="link">
                Not now, back to my events
              </Link>
            ) : signup ? (
              <span>
                Already have an account?{" "}
                <Link to={`/signin${query}`} className="link">
                  Log in
                </Link>
              </span>
            ) : (
              <span>
                New to Plannr?{" "}
                <Link to={`/signup${query}`} className="link">
                  Create an account
                </Link>
              </span>
            )}
            {!upgrading && !accountsOff && (
              <span>
                Just looking?{" "}
                <button type="button" className="link" onClick={demo}>
                  Explore the demo
                </button>{" "}
                with sample events. It stays in this browser.
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
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
