import { type ReactNode, useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { useStore } from "../store/store";
import { AccountMenu } from "./accountMenu";
import { Logo, Toran } from "./brand";
import { CommandPalette } from "./commandPalette";
import { useActivity, useUnread } from "./inbox";
import { SkipLink } from "./ui";
/** The frame around every signed-in screen: navigation, sync state, account and ⌘K. */
export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const [palette, setPalette] = useState(false);
  useActivity();

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />
      <Toran />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-8">
          <Logo to="/events" />
          <Nav />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-2 text-body"
              onClick={() => setPalette(true)}
              aria-keyshortcuts="Control+K Meta+K"
              aria-label="Search"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4.5 4.5" />
              </svg>
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-line bg-sand px-1.5 font-mono text-xs text-muted sm:inline">
                ⌘K
              </kbd>
            </button>
            <SyncBadge />
            <AccountMenu />
          </div>
        </div>
      </header>
      {state.mode === "demo" && <DemoRibbon />}
      {children}
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

function Nav() {
  const unread = useUnread();
  const item = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold no-underline ${isActive ? "bg-sand text-ink" : "text-body hover:bg-sand"}`;
  return (
    <nav aria-label="Main" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
      <NavLink to="/today" className={item}>
        Today
      </NavLink>
      <NavLink to="/events" end className={item}>
        Events
      </NavLink>
      <NavLink to="/inbox" className={item}>
        Inbox
        {unread > 0 && (
          <span className="ml-1.5 rounded-full bg-maroon px-1.5 py-px text-xs text-white">
            <span className="sr-only">, </span>
            {unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </NavLink>
    </nav>
  );
}

/** The sync badge's dot colour and words: offline, saving, or saved. */
function syncDisplay(pending: number, offline: boolean): [dot: string, text: string] {
  if (offline) return ["bg-rust", pending ? `Offline · ${pending} waiting` : "Offline"];
  return pending ? ["bg-marigold", "Saving…"] : ["bg-leaf", "Saved"];
}

/** Whether changes are saved, saving, or waiting for a connection. The demo saves locally and shows none. */
function SyncBadge() {
  const { state } = useStore();
  if (state.mode === "demo") return null;
  const { pending, offline } = state.sync;
  const [dot, text] = syncDisplay(pending, offline);
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs font-medium text-body">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="sr-only md:not-sr-only">{text}</span>
    </span>
  );
}

function DemoRibbon() {
  return (
    <div className="border-b border-amber-line bg-cream">
      <p className="mx-auto m-0 flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] text-amber-ink sm:px-8">
        <span>
          <strong>You're exploring the demo.</strong> Changes stay in this browser.
        </span>
        <Link to="/signup" className="link font-semibold text-amber-ink">
          Create an account to plan for real
        </Link>
      </p>
    </div>
  );
}
