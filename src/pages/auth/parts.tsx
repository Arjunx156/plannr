import { Link } from "react-router";
import { saveHint } from "../../components/accountMenu";
import { Kolam, Logo, Toran } from "../../components/brand";
import type { Profile } from "../../data/types";
import { longDate } from "../../lib/dates";
import { inr } from "../../lib/format";
import type { PlanDraft } from "../../lib/plan";
import type { SignInMethods } from "../../shared/types";
import type { Busy, Variant } from "./types";

/** The sign-in page's building blocks that hold no state of their own. */

/** The maroon side panel: what signing in gets them, and the draft that's waiting if there is one. */
export function AuthAside({
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

export function GoogleButton({ busy, onClick }: { busy: Busy; onClick: () => void }) {
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
export function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p id="auth-error" role="alert" className="m-0 text-[13px] font-medium text-rust-ink">
      {error}
    </p>
  );
}

/** The switch between forms, and the way into the demo when it's offered. */
export function AuthFooter({
  variant,
  query,
  onDemo,
}: {
  variant: Variant;
  query: string;
  onDemo?: () => void;
}) {
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
export function AccountsOff({ onDemo }: { onDemo: () => void }) {
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

/** Start without signing up; the plans are saved online for this browser. */
export function GuestOption({
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

export function Divider() {
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
