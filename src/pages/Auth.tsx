import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Spinner, usePageMeta } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { draftPlan } from "../lib/plan";
import type { AccountUser, SignInMethods } from "../shared/types";
import { useAccount } from "../store/account";
import { type AppState, toast, useStore } from "../store/store";
import { type Attempt, EmailSignIn } from "./auth/EmailSignIn";
import {
  AccountsOff,
  AuthAside,
  AuthFooter,
  Divider,
  FormError,
  GoogleButton,
  GuestOption,
} from "./auth/parts";
import type { Busy, Mode, Variant } from "./auth/types";

/** A sign-in error in words a family member can act on. */
function codeError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again.";
  if (e.status === 0) return e.message;
  if (e.status === 429) return "Too many tries. Wait a minute, then try again.";
  if (/expired/i.test(e.message)) return "That code has expired. Send a new one.";
  if (/invalid|otp/i.test(e.message)) return "That code doesn't match. Check the latest email from Plannr.";
  return e.message;
}

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

const ACCEPT_DRAFT = "/new/generating?accept=1";

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
