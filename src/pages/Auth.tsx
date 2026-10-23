import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Kolam, Logo, Toran, usePageMeta } from "../components/ui";
import { longDate } from "../lib/dates";
import { inr } from "../lib/format";
import { draftPlan } from "../lib/plan";
import { toast, useStore } from "../store/store";

type Channel = "phone" | "email";

export function Auth({ mode }: { mode: "signup" | "signin" }) {
  const signup = mode === "signup";
  usePageMeta(signup ? "Create your account" : "Log in", { private: true });
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const draft = state.draft;
  const plan = draft.generated ? draftPlan(draft.profile) : undefined;

  const [channel, setChannel] = useState<Channel>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [seconds, setSeconds] = useState(30);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!sent || seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [sent, seconds]);

  const destination = channel === "phone" ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : email;

  const finish = () => {
    dispatch({ type: "signIn" });
    if (signup) {
      navigate(next === "accept" ? "/onboarding?next=accept" : "/onboarding");
      return;
    }
    dispatch(toast(`Welcome back, ${state.session.firstName}.`));
    navigate(next && next.startsWith("/") ? next : "/events");
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (channel === "phone" && !/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a 10-digit Indian mobile number, without +91.");
      return;
    }
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter an email address like name@example.com.");
      return;
    }
    setError("");
    setSent(true);
    setSeconds(30);
    setCode(Array(6).fill(""));
    window.setTimeout(() => boxes.current[0]?.focus(), 0);
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (code.some((d) => !d)) {
      setError("Enter all six digits from the message.");
      return;
    }
    finish();
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
            {signup
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
                ? "Describe an event once, then plan it with family, co-planners and volunteers. Everyone sees the same budget."
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
            {signup ? "Create your account" : "Log in to Plannr"}
          </h2>
          <button type="button" className="btn btn-secondary btn-lg w-full border-line-2" onClick={finish}>
            <GoogleMark />
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="grid grid-cols-2 rounded-[10px] bg-sand-2 p-1 text-sm font-semibold"
          >
            {(["email", "phone"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={channel === c}
                onClick={() => {
                  setChannel(c);
                  setSent(false);
                  setError("");
                }}
                className={`min-h-10 rounded-[7px] ${channel === c ? "bg-surface shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-body"}`}
              >
                {c === "email" ? "Email" : "Phone"}
              </button>
            ))}
          </div>

          {!sent ? (
            <form onSubmit={send} className="flex flex-col gap-5" noValidate>
              {channel === "phone" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="phone" className="label">
                    Mobile number
                  </label>
                  <div className="field gap-2.5">
                    <span className="text-body">+91</span>
                    <span aria-hidden="true" className="h-5 w-px bg-line" />
                    <input
                      id="phone"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="98470 12345"
                      className="min-w-0 flex-1 bg-transparent outline-none"
                      aria-invalid={!!error}
                      aria-describedby={error ? "auth-error" : undefined}
                    />
                  </div>
                </div>
              ) : (
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
              )}
              {error && (
                <p id="auth-error" role="alert" className="m-0 text-[13px] font-medium text-rust-ink">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-lg">
                {channel === "phone" ? "Send code by SMS" : "Email me a code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <span className="label">{channel === "phone" ? "Mobile number" : "Email"}</span>
                <div className="field gap-2.5">
                  <span className="min-w-0 flex-1 truncate">{destination}</span>
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
                <legend className="label mb-2">
                  6-digit code sent {channel === "phone" ? "by SMS" : "by email"}
                </legend>
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
                    <button type="button" className="link" onClick={() => setSeconds(30)}>
                      Resend code
                    </button>
                  )}
                  {channel === "phone" && (
                    <>
                      {" · or "}
                      <button
                        type="button"
                        className="link font-medium"
                        onClick={() => {
                          setSeconds(30);
                          dispatch(toast("Code sent on WhatsApp."));
                        }}
                      >
                        get it on WhatsApp
                      </button>
                    </>
                  )}
                </span>
              </fieldset>
              {error && (
                <p role="alert" className="m-0 text-[13px] font-medium text-rust-ink">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-lg">
                {signup ? (plan ? "Verify and save plan" : "Verify and continue") : "Verify and log in"}
              </button>
            </form>
          )}

          <div className="flex flex-col gap-1 border-t border-line pt-1.5">
            {signup ? (
              <>
                <Link to={plan ? "/new/plan" : "/new"} className="link mt-1.5 text-sm">
                  Keep planning as a guest
                </Link>
                <span className="text-[13px] leading-[1.4] text-muted">
                  Your draft stays on this device for 7 days. We'll remind you to save it before inviting
                  anyone.
                </span>
              </>
            ) : (
              <span className="mt-1.5 text-sm text-body">
                New to Plannr?{" "}
                <Link to="/signup" className="link">
                  Create an account
                </Link>
              </span>
            )}
          </div>
        </div>
      </main>
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
