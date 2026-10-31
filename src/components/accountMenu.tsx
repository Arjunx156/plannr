import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { SignInMethods } from "../shared/types";
import { useAccount } from "../store/account";
import { useStore } from "../store/store";
import type { AppState } from "../store/types";
import { Menu, MenuDivider, MenuItem, Modal } from "./overlays";

/** The line under the name in the account menu: where the plans are kept. */
function accountLine(state: AppState, guest: boolean): string {
  if (state.mode === "demo") return "Demo · saved in this browser";
  if (guest) return "Guest account";
  return `${state.account.user?.email ?? ""} · ${state.session.plan}`;
}

/** A menu item's action: close the menu, then go to a page. */
function useGo(close: () => void) {
  const navigate = useNavigate();
  return (to: string) => () => {
    close();
    void navigate(to);
  };
}

/** The account menu in the top bar: who's signed in, saving the demo, and signing out. */
export function AccountMenu() {
  const { state } = useStore();
  const { signOut } = useAccount();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const guest = state.mode === "account" && !!state.account.user?.isAnonymous;
  const leave = async () => {
    setConfirm(false);
    await signOut();
    void navigate("/");
  };
  // A guest's plans live only in this browser, so signing out asks first.
  const signOutNow = () => {
    if (guest) setConfirm(true);
    else void leave();
  };
  return (
    <>
      <Menu
        label="Account"
        button={({ open, toggle, id }) => (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-peacock text-xs font-semibold text-white"
            aria-label="Account"
          >
            {state.session.initials}
          </button>
        )}
      >
        {(close) => (
          <>
            <span className="flex flex-col px-3 py-2">
              <span className="text-sm font-semibold">{state.session.name}</span>
              <span className="text-xs text-muted">{accountLine(state, guest)}</span>
            </span>
            <MenuDivider />
            {state.mode === "demo" ? (
              <DemoItems close={close} />
            ) : (
              <AccountItems close={close} guest={guest} onSignOut={signOutNow} />
            )}
          </>
        )}
      </Menu>
      <GuestSignOut open={confirm} onClose={() => setConfirm(false)} onLeave={leave} />
    </>
  );
}

function DemoItems({ close }: { close: () => void }) {
  const { dispatch } = useStore();
  const go = useGo(close);
  const reset = () => {
    close();
    dispatch({ type: "resetDemo" });
    dispatch({ type: "toast", toast: { id: "demo-reset", text: "Demo data restored." } });
  };
  const leave = () => {
    dispatch({ type: "signOut" });
    go("/")();
  };
  return (
    <>
      <MenuItem onSelect={go("/signup")}>Create an account</MenuItem>
      <MenuItem onSelect={go("/account")}>Install the app</MenuItem>
      <MenuItem onSelect={reset}>Reset demo data</MenuItem>
      <MenuItem danger onSelect={leave}>
        Leave the demo
      </MenuItem>
    </>
  );
}

interface AccountItemsProps {
  close: () => void;
  guest: boolean;
  onSignOut: () => void;
}

function AccountItems({ close, guest, onSignOut }: AccountItemsProps) {
  const go = useGo(close);
  const signOut = () => {
    close();
    onSignOut();
  };
  return (
    <>
      {guest && <MenuItem onSelect={go("/signup")}>Keep your plans on every device</MenuItem>}
      <MenuItem onSelect={go("/account")}>Account, app and reminders</MenuItem>
      <MenuItem danger onSelect={signOut}>
        Sign out
      </MenuItem>
    </>
  );
}

interface GuestSignOutProps {
  open: boolean;
  onClose: () => void;
  onLeave: () => Promise<void>;
}

/** Signing out of a guest account loses its plans for good, so it says so and offers to keep them. */
function GuestSignOut({ open, onClose, onLeave }: GuestSignOutProps) {
  const { state } = useStore();
  return (
    <Modal open={open} onClose={onClose} title="Sign out of the guest account?">
      <p className="m-0 text-sm leading-normal text-body">
        Guest plans are tied to this browser. Once you sign out you can't open them again, and nobody can
        recover them. {saveHint(state.account.methods)} first and they stay yours on every device.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/signup" className="btn btn-primary" onClick={onClose}>
          Keep my plans
        </Link>
        <button type="button" className="btn btn-danger" onClick={onLeave}>
          Sign out anyway
        </button>
      </div>
    </Modal>
  );
}

/** How a guest keeps their plans, in the words of whichever sign-in this server offers. */
export function saveHint(methods: SignInMethods | undefined): string {
  if (methods?.google && methods.email) return "Sign in with Google or an email code";
  if (methods?.email) return "Add your email";
  return "Sign in with Google";
}
