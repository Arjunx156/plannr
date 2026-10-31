import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { TextField } from "../components/fields";
import { Modal } from "../components/overlays";
import { usePageMeta } from "../components/pageMeta";
import { AppShell } from "../components/shell";
import { api } from "../lib/api";
import { type ReminderState, reminderState, remindersOff, remindersOn, useInstall } from "../lib/device";
import { useAccount } from "../store/account";
import { toast, useStore } from "../store/store";
import { Section } from "./tabs/layout";

const REMINDER_TEXT: Record<ReminderState, string> = {
  on: "On for this device. Each morning you get one notification with what's due that day.",
  off: "Get one notification each morning with the tasks, payments and functions due that day.",
  blocked:
    "Notifications are blocked for Plannr in this browser's settings. Allow them there, then come back.",
  unsupported:
    "This browser can't show reminders. On an iPhone, add Plannr to your home screen first; on Android, use Chrome.",
  unavailable: "Reminders aren't switched on for this site yet.",
};

const INSTALL_TEXT: Record<ReturnType<typeof useInstall>["state"], string> = {
  installed: "Installed. Plannr opens from your home screen, and works without a signal.",
  ready: "Add Plannr to your home screen. It opens full screen and keeps working at venues with no signal.",
  ios: "In Safari, tap the Share button, then “Add to Home Screen”. Plannr then opens full screen and works without a signal.",
  unavailable:
    "Plannr works without a signal once you've opened it here. To add it to your home screen, use your browser's menu (in Chrome: ⋮ then “Install app” or “Add to Home screen”).",
};

/** The goodbye, saying how many shared plans went to a co-planner rather than being deleted. */
function deletedText(handedOver: number): string {
  if (!handedOver) return "Your account and plans are deleted.";
  const plans = handedOver === 1 ? "One shared plan was" : `${handedOver} shared plans were`;
  return `Your account is deleted. ${plans} handed to a co-planner.`;
}

/** This device's morning reminders: whether they're on, and switching them. */
function useReminders(account: boolean) {
  const { dispatch } = useStore();
  const [state, setState] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!account) return;
    let live = true;
    void reminderState()
      .catch(() => "unavailable" as const)
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [account]);
  const toggle = async () => {
    setBusy(true);
    try {
      setState(state === "on" ? await remindersOff() : await remindersOn());
    } catch (e) {
      dispatch(toast((e as Error).message || "Couldn't change reminders. Try again."));
    }
    setBusy(false);
  };
  return { state, busy, toggle };
}

/** /account — this device, your data, and leaving. */
export function Account() {
  usePageMeta("Account and privacy", { private: true });
  const { state } = useStore();
  const account = state.mode === "account";
  const guest = account && !!state.account.user?.isAnonymous;
  const [deleting, setDeleting] = useState(false);
  return (
    <AppShell>
      <main id="main" className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">{state.session.name}</span>
          <h1 className="font-serif text-[40px] leading-none">Account and privacy</h1>
        </div>
        <OnThisPhone account={account} />
        {account ? (
          <YourData guest={guest} onDelete={() => setDeleting(true)} />
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
        <DeleteAccount open={deleting} onClose={() => setDeleting(false)} />
      </main>
    </AppShell>
  );
}

/** Installing Plannr, and morning reminders for an account. */
function OnThisPhone({ account }: { account: boolean }) {
  const install = useInstall();
  const reminders = useReminders(account);
  const on = reminders.state === "on";
  return (
    <Section title="On this phone">
      <div className="flex flex-col gap-2 text-sm">
        <span className="font-semibold">Use Plannr like an app</span>
        <span className="text-body">{INSTALL_TEXT[install.state]}</span>
        {install.state === "ready" && (
          <button type="button" className="btn btn-secondary btn-sm self-start" onClick={install.install}>
            Install Plannr
          </button>
        )}
      </div>
      {account && (
        <div className="flex flex-col gap-2 border-t border-sand-2 pt-3 text-sm">
          <span className="font-semibold">Morning reminders</span>
          <span className="text-body">{reminders.state ? REMINDER_TEXT[reminders.state] : "Checking…"}</span>
          {(on || reminders.state === "off") && (
            <button
              type="button"
              className={`btn btn-sm self-start ${on ? "btn-ghost" : "btn-secondary"}`}
              disabled={reminders.busy}
              onClick={reminders.toggle}
            >
              {on ? "Turn off on this device" : "Turn on reminders"}
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

function YourData({ guest, onDelete }: { guest: boolean; onDelete: () => void }) {
  return (
    <Section title="Your data">
      <p className="m-0 text-sm text-body">
        Your plans are shared only with the people you invite and the links you send. Guests who answer an
        RSVP see only their own invitation, and vendors only their call sheet. Plannr doesn't sell or share
        your data.
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
          Deletes your account, your templates and every plan only you can see. Plans you share with others
          stay with them: the longest-standing co-planner becomes the owner.
          {guest ? " As a guest, this is the same as signing out for good." : ""}
        </span>
        <button type="button" className="btn btn-danger btn-sm self-start" onClick={onDelete}>
          Delete my account…
        </button>
      </div>
    </Section>
  );
}

/** Deleting the account, once they've typed DELETE. */
function DeleteAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  const { signOut } = useAccount();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      const out = await api.deleteAccount();
      await signOut();
      dispatch(toast(deletedText(out.handedOver)));
      void navigate("/");
    } catch (e) {
      dispatch(toast((e as Error).message));
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (confirm === "DELETE") void remove();
  };
  return (
    <Modal open={open} onClose={onClose} title="Delete your account?">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <p className="m-0 text-sm text-body">
          This can't be undone. Download your data first if you might want it.
        </p>
        <TextField
          id="delete-confirm"
          label="Type DELETE to confirm"
          autoComplete="off"
          value={confirm}
          onChange={setConfirm}
        />
        <button type="submit" className="btn btn-danger self-start" disabled={confirm !== "DELETE" || busy}>
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </form>
    </Modal>
  );
}
