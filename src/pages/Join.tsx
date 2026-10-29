import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Field, Logo, Spinner, Toran, usePageMeta } from "../components/ui";
import { ApiError, api } from "../lib/api";
import { longDate } from "../lib/dates";
import { KIND_LABEL } from "../lib/intake";
import { type InvitePreview, ROLE_LABEL } from "../shared/types";
import { useAccount } from "../store/account";
import { toast, useStore } from "../store/store";

const CAN: Record<InvitePreview["role"], string> = {
  owner: "",
  planner:
    "You'll be able to tick off tasks, change the budget and work with the assistant. Every change is kept in the plan's history, so anything can be undone.",
  viewer:
    "You'll see the whole plan and follow along as it changes. The owner can make you a co-planner later.",
};

/** /join/:token: an invitation to plan an event together. */
export function Join() {
  const { token = "" } = useParams();
  usePageMeta("You're invited", { private: true });
  const { state, dispatch } = useStore();
  const { refreshPlans, signedIn } = useAccount();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InvitePreview | null>();
  const [problem, setProblem] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .invite(token)
      .then((i) => live && setInvite(i))
      .catch((e) => {
        if (!live) return;
        setInvite(null);
        setProblem(e instanceof ApiError && e.status === 0 ? e.message : "This invite link isn't valid.");
      });
    return () => {
      live = false;
    };
  }, [token]);

  const account = state.mode === "account" && !!state.account.user;
  const member = invite ? state.remote[invite.eventId] : undefined;
  const methods = state.account.methods;
  const next = `?next=${encodeURIComponent(`/join/${token}`)}`;

  const accept = async () => {
    const joined = await api.acceptInvite(token);
    await refreshPlans();
    dispatch(toast(`You're in as ${ROLE_LABEL[joined.role].toLowerCase()}.`));
    navigate(`/events/${joined.eventId}`);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setBusy(false);
      setError((e as Error).message || "Something went wrong. Try again.");
    }
  };

  const joinAsGuest = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Add your name so the others know who joined.");
      return;
    }
    void run(async () => {
      await api.signInGuest();
      await api.rename(clean);
      await signedIn();
      await accept();
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-sand">
      <Toran />
      <div className="flex items-center px-5 py-4 sm:px-10">
        <Logo to="/" />
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-12 sm:items-center">
        <section className="flex w-full max-w-[560px] flex-col gap-5 rounded-xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,.06),0_16px_48px_rgba(60,40,20,.10)] sm:px-12 sm:py-10">
          {invite === undefined ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Spinner label="Opening the invite" />
            </div>
          ) : invite === null || !invite.valid ? (
            <>
              <span className="eyebrow text-muted">Invitation</span>
              <h1 className="font-serif text-[34px] leading-[1.1]">
                {invite ? `${invite.reason ?? "This invite can't be used"}.` : problem}
              </h1>
              <p className="m-0 text-body">
                {invite
                  ? `Ask ${invite.invitedBy} to send you a new link for ${invite.eventName}.`
                  : "Check that you opened the whole link, or ask for a new one."}
              </p>
              <Link to="/" className="btn btn-outline self-start">
                Go to Plannr
              </Link>
            </>
          ) : (
            <>
              <span className="eyebrow text-peacock">◆ Invitation</span>
              <h1 className="font-serif text-[34px] leading-[1.1]">
                {invite.invitedBy} invited you to plan {invite.eventName}
              </h1>
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted">Event</dt>
                <dd className="m-0">
                  {KIND_LABEL[invite.kind]} · {longDate(invite.date)}
                </dd>
                <dt className="text-muted">You'll join as</dt>
                <dd className="m-0 font-medium">
                  {ROLE_LABEL[invite.role]}
                  {invite.side ? ` · ${invite.side}` : ""}
                </dd>
              </dl>
              <p className="m-0 text-[15px] leading-normal text-body">{CAN[invite.role]}</p>

              {member ? (
                <Link to={`/events/${invite.eventId}`} className="btn btn-primary btn-lg">
                  You're already in. Open the plan
                </Link>
              ) : account ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={busy}
                  onClick={() => run(accept)}
                >
                  {busy ? "Joining…" : `Join as ${state.session.name}`}
                </button>
              ) : (
                <div className="flex flex-col gap-4">
                  {methods?.guest && (
                    <form onSubmit={joinAsGuest} className="flex flex-col gap-3" noValidate>
                      <Field label="Your name" htmlFor="join-name" hint="So the others know who joined.">
                        <input
                          id="join-name"
                          className="field"
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </Field>
                      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                        {busy ? "Joining…" : "Join the plan"}
                      </button>
                    </form>
                  )}
                  <span className="text-sm text-body">
                    Have an account?{" "}
                    <Link to={`/signin${next}`} className="link">
                      Log in to join
                    </Link>
                    {" · "}
                    <Link to={`/signup${next}`} className="link">
                      Create one
                    </Link>
                  </span>
                </div>
              )}
              {error && (
                <p role="alert" className="m-0 text-[13px] font-medium text-rust-ink">
                  {error}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
