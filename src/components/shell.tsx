import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { seedNotifications } from "../data/seed";
import type { PlannrEvent } from "../data/types";
import { api } from "../lib/api";
import { tabsFor } from "../pages/tabs/list";
import type { SignInMethods } from "../shared/types";
import { useAccount } from "../store/account";
import { useStore } from "../store/store";
import { Logo, Menu, MenuDivider, MenuItem, Modal, Toran } from "./ui";

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
              <span aria-hidden="true">⌕</span>
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-line bg-sand px-1.5 font-mono text-[10px] text-muted sm:inline">
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
          <span className="ml-1.5 rounded-full bg-maroon px-1.5 py-px text-[11px] text-white">
            <span className="sr-only">, </span>
            {unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </NavLink>
    </nav>
  );
}

function SyncBadge() {
  const { state } = useStore();
  if (state.mode === "demo") return null;
  const { pending, offline } = state.sync;
  const [dot, text] = offline
    ? ["bg-rust", pending ? `Offline · ${pending} waiting` : "Offline"]
    : pending
      ? ["bg-marigold", "Saving…"]
      : ["bg-leaf", "Saved"];
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

function AccountMenu() {
  const { state, dispatch } = useStore();
  const { signOut } = useAccount();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const guest = state.mode === "account" && !!state.account.user?.isAnonymous;
  const leave = async () => {
    setConfirm(false);
    await signOut();
    navigate("/");
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
              <span className="text-xs text-muted">
                {state.mode === "demo"
                  ? "Demo · saved in this browser"
                  : guest
                    ? "Guest account"
                    : `${state.account.user?.email ?? ""} · ${state.session.plan}`}
              </span>
            </span>
            <MenuDivider />
            {state.mode === "demo" ? (
              <>
                <MenuItem
                  onSelect={() => {
                    close();
                    navigate("/signup");
                  }}
                >
                  Create an account
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close();
                    navigate("/account");
                  }}
                >
                  Install the app
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close();
                    dispatch({ type: "resetDemo" });
                    dispatch({ type: "toast", toast: { id: "demo-reset", text: "Demo data restored." } });
                  }}
                >
                  Reset demo data
                </MenuItem>
                <MenuItem
                  danger
                  onSelect={() => {
                    close();
                    dispatch({ type: "signOut" });
                    navigate("/");
                  }}
                >
                  Leave the demo
                </MenuItem>
              </>
            ) : (
              <>
                {guest && (
                  <MenuItem
                    onSelect={() => {
                      close();
                      navigate("/signup");
                    }}
                  >
                    Keep your plans on every device
                  </MenuItem>
                )}
                <MenuItem
                  onSelect={() => {
                    close();
                    navigate("/account");
                  }}
                >
                  Account, app and reminders
                </MenuItem>
                <MenuItem
                  danger
                  onSelect={() => {
                    close();
                    if (guest) setConfirm(true);
                    else void leave();
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Sign out of the guest account?">
        <p className="m-0 text-sm leading-normal text-body">
          Guest plans are tied to this browser. Once you sign out you can't open them again, and nobody can
          recover them. {saveHint(state.account.methods)} first and they stay yours on every device.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/signup" className="btn btn-primary" onClick={() => setConfirm(false)}>
            Keep my plans
          </Link>
          <button type="button" className="btn btn-danger" onClick={leave}>
            Sign out anyway
          </button>
        </div>
      </Modal>
    </>
  );
}

/** How a guest keeps their plans, in the words of whichever sign-in this server offers. */
export function saveHint(methods: SignInMethods | undefined): string {
  if (methods?.google && methods.email) return "Sign in with Google or an email code";
  if (methods?.email) return "Add your email";
  return "Sign in with Google";
}

// ---------------------------------------------------------------- inbox data

const ACTIVITY_MS = 30_000;

/** Keeps the account's recent activity fresh while a signed-in screen is open. */
function useActivity() {
  const { state, dispatch } = useStore();
  const account = state.mode === "account" && !!state.account.user;
  useEffect(() => {
    if (!account) return;
    let live = true;
    const load = () => {
      if (document.hidden) return;
      api
        .activity()
        .then((activity) => live && dispatch({ type: "setActivity", activity }))
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, ACTIVITY_MS);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [account, dispatch]);
}

export interface InboxItem {
  id: string;
  text: string;
  /** ISO time for account activity; already-written words for the demo's. */
  at?: string;
  when?: string;
  by?: string | null;
  eventId?: string;
  eventName?: string;
  unread: boolean;
}

/** What the inbox shows: co-planners' changes with an account, the story's updates in the demo. */
export function useInbox(): InboxItem[] {
  const { state } = useStore();
  return useMemo(() => {
    if (state.mode === "demo")
      return seedNotifications().map((n) => ({
        id: n.id,
        text: n.text,
        when: n.when,
        eventId: n.eventId,
        eventName: state.events.find((e) => e.id === n.eventId)?.name,
        unread: n.unread && !state.notificationsRead,
      }));
    return state.activity
      .filter((a) => !a.mine)
      .map((a) => ({
        id: a.id,
        text: a.summary,
        at: a.at,
        by: a.by,
        eventId: a.eventId,
        eventName: a.eventName,
        unread: a.at > state.inboxSeen,
      }));
  }, [state.mode, state.activity, state.events, state.notificationsRead, state.inboxSeen]);
}

function useUnread(): number {
  return useInbox().filter((i) => i.unread).length;
}

// ---------------------------------------------------------------- command palette

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

function taskList(ev: PlannrEvent) {
  return ev.layout === "empty" ? [] : ev.tasks.list;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const { id: currentId } = useParams();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const go = useCallback(
    (to: string) => () => {
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const list: Command[] = [];
    const current = state.events.find((e) => e.id === currentId);
    if (current)
      for (const t of tabsFor(current))
        list.push({
          id: `tab-${t.id}`,
          label: t.label,
          hint: current.name,
          group: "This event",
          run: go(`/events/${current.id}${t.id ? `/${t.id}` : ""}`),
        });
    for (const ev of state.events.filter((e) => !e.archived))
      list.push({
        id: `ev-${ev.id}`,
        label: ev.name,
        hint: ev.listMeta,
        group: "Events",
        run: go(`/events/${ev.id}`),
      });
    list.push(
      { id: "new", label: "Plan a new event", group: "Go to", run: go("/new?fresh=1") },
      {
        id: "today",
        label: "Today",
        hint: "What's due across every event",
        group: "Go to",
        run: go("/today"),
      },
      { id: "inbox", label: "Inbox", hint: "What co-planners changed", group: "Go to", run: go("/inbox") },
      { id: "events", label: "My events", group: "Go to", run: go("/events") },
    );
    if (state.mode === "demo")
      list.push({ id: "signup", label: "Create an account", group: "Go to", run: go("/signup") });
    const shown = list.filter((c) => match(`${c.label} ${c.hint ?? ""}`));
    if (q.length >= 2)
      for (const ev of state.events)
        for (const t of taskList(ev))
          if (t.title.toLowerCase().includes(q) && shown.length < 40)
            shown.push({
              id: `task-${ev.id}-${t.id}`,
              label: t.title,
              hint: `${ev.name}${t.done ? " · done" : ""}`,
              group: "Tasks",
              run: go(`/events/${ev.id}/tasks?task=${encodeURIComponent(t.id)}`),
            });
    return shown;
  }, [query, state.events, state.mode, currentId, go]);

  const index = Math.min(active, Math.max(0, commands.length - 1));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((index + 1) % Math.max(1, commands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((index - 1 + commands.length) % Math.max(1, commands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[index]?.run();
    }
  };

  let lastGroup = "";
  return (
    <Modal open={open} onClose={onClose} label="Search and commands" width={600}>
      <input
        ref={input}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={commands[index] ? `${listId}-${commands[index].id}` : undefined}
        aria-label="Search events, tasks and commands"
        placeholder="Search events, tasks and commands"
        className="field text-base"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
      />
      <div
        id={listId}
        role="listbox"
        aria-label="Results"
        className="flex max-h-[min(60vh,440px)] flex-col overflow-y-auto"
      >
        {commands.map((c, i) => {
          const header = c.group !== lastGroup;
          lastGroup = c.group;
          return (
            <div key={c.id} className="flex flex-col">
              {header && <span className="eyebrow px-3 pt-3 pb-1 text-muted">{c.group}</span>}
              <div
                id={`${listId}-${c.id}`}
                role="option"
                aria-selected={i === index}
                tabIndex={-1}
                onMouseEnter={() => setActive(i)}
                onClick={c.run}
                onKeyDown={() => {}}
                className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${i === index ? "bg-sand" : ""}`}
              >
                <span className="font-medium">{c.label}</span>
                {c.hint && <span className="truncate text-xs text-muted">{c.hint}</span>}
              </div>
            </div>
          );
        })}
        {!commands.length && (
          <p className="m-0 px-3 py-6 text-center text-sm text-muted">Nothing matches “{query}”.</p>
        )}
      </div>
      <span className="text-xs text-muted">↑ ↓ to move · Enter to open · Esc to close</span>
    </Modal>
  );
}
