import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AppShell } from "../components/shell";
import { Field, Modal, usePageMeta } from "../components/ui";
import { api } from "../lib/api";
import { type ReminderState, reminderState, remindersOff, remindersOn, useInstall } from "../lib/device";
import { useAccount } from "../store/account";
import { toast, useStore } from "../store/store";
import { Section } from "./tabs/common";

const REMINDER_TEXT: Record<ReminderState, string> = {
  on: "On for this device. Each morning you get one notification with what's due that day.",
  off: "Get one notification each morning with the tasks, payments and functions due that day.",
  blocked:
    "Notifications are blocked for Plannr in this browser's settings. Allow them there, then come back.",
  unsupported:
    "This browser can't show reminders. On an iPhone, add Plannr to your home screen first; on Android, use Chrome.",
  unavailable: "Reminders aren't switched on for this site yet.",
};

/** /account — this device, your data, and leaving. */
export function Account() {
  usePageMeta("Account and privacy", { private: true });
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const { signOut } = useAccount();
  const install = useInstall();
  const account = state.mode === "account";
  const guest = account && !!state.account.user?.isAnonymous;
  const [reminders, setReminders] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!account) return;
    let live = true;
    reminderState().then((s) => live && setReminders(s));
    return () => {
      live = false;
    };
  }, [account]);

  const toggleReminders = async () => {
    setBusy(true);
    try {
      setReminders(reminders === "on" ? await remindersOff() : await remindersOn());
    } catch (e) {
      dispatch(toast((e as Error).message || "Couldn't change reminders. Try again."));
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      const out = await api.deleteAccount();
      await signOut();
      dispatch(
        toast(
          out.handedOver
            ? `Your account is deleted. ${out.handedOver === 1 ? "One shared plan was" : `${out.handedOver} shared plans were`} handed to a co-planner.`
            : "Your account and plans are deleted.",
        ),
      );
      navigate("/");
    } catch (e) {
      dispatch(toast((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <main id="main" className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">{state.session.name}</span>
          <h1 className="font-serif text-[40px] leading-none">Account and privacy</h1>
        </div>

        <Section title="On this phone">
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">Use Plannr like an app</span>
            {install.state === "installed" ? (
              <span className="text-body">
                Installed. Plannr opens from your home screen, and works without a signal.
              </span>
            ) : install.state === "ready" ? (
              <>
                <span className="text-body">
                  Add Plannr to your home screen. It opens full screen and keeps working at venues with no
                  signal.
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm self-start"
                  onClick={install.install}
                >
                  Install Plannr
                </button>
              </>
            ) : install.state === "ios" ? (
              <span className="text-body">
                In Safari, tap the Share button, then “Add to Home Screen”. Plannr then opens full screen and
                works without a signal.
              </span>
            ) : (
              <span className="text-body">
                Plannr works without a signal once you've opened it here. To add it to your home screen, use
                your browser's menu (in Chrome: ⋮ then “Install app” or “Add to Home screen”).
              </span>
            )}
          </div>
          {account && (
            <div className="flex flex-col gap-2 border-t border-sand-2 pt-3 text-sm">
              <span className="font-semibold">Morning reminders</span>
              <span className="text-body">{reminders ? REMINDER_TEXT[reminders] : "Checking…"}</span>
              {(reminders === "on" || reminders === "off") && (
                <button
                  type="button"
                  className={`btn btn-sm self-start ${reminders === "on" ? "btn-ghost" : "btn-secondary"}`}
                  disabled={busy}
                  onClick={toggleReminders}
                >
                  {reminders === "on" ? "Turn off on this device" : "Turn on reminders"}
                </button>
              )}
            </div>
          )}
        </Section>

        {account ? (
          <Section title="Your data">
            <p className="m-0 text-sm text-body">
              Your plans are shared only with the people you invite and the links you send. Guests who answer
              an RSVP see only their own invitation, and vendors only their call sheet. Plannr doesn't sell or
              share your data.
            </p>
            <span className="flex flex-wrap gap-2">
              <a href="/api/account/export" className="btn btn-secondary btn-sm" download>
                Download all my data
              </a>
              <Link to="/onboarding" className="btn btn-ghost btn-sm">
                Name, city and language
              </Link>
            </span>
            <div className="flex flex-col gap-2 border-t border-sand-2 pt-3 text-sm">
              <span className="font-semibold">Delete my account</span>
              <span className="text-body">
                Deletes your account, your templates and every plan only you can see. Plans you share with
                others stay with them: the longest-standing co-planner becomes the owner.
                {guest ? " As a guest, this is the same as signing out for good." : ""}
              </span>
              <button
                type="button"
                className="btn btn-danger btn-sm self-start"
                onClick={() => setDeleting(true)}
              >
                Delete my account…
              </button>
            </div>
          </Section>
        ) : (
          <Section title="Your data">
            <p className="m-0 text-sm text-body">
              The demo keeps everything in this browser only; nothing is sent anywhere.{" "}
              <Link to="/signup" className="link">
                Create an account
              </Link>{" "}
              to keep plans on every device and share them.
            </p>
          </Section>
        )}

        <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete your account?">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (confirm === "DELETE") void remove();
            }}
          >
            <p className="m-0 text-sm text-body">
              This can't be undone. Download your data first if you might want it.
            </p>
            <Field label="Type DELETE to confirm" htmlFor="delete-confirm">
              <input
                id="delete-confirm"
                className="field"
                autoComplete="off"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <button
              type="submit"
              className="btn btn-danger self-start"
              disabled={confirm !== "DELETE" || busy}
            >
              {busy ? "Deleting…" : "Delete my account"}
            </button>
          </form>
        </Modal>
      </main>
    </AppShell>
  );
}
