import { Link, Navigate, useNavigate } from "react-router";
import { Bar, HUE_COLOR, Logo, Menu, MenuDivider, MenuItem, Toran, usePageMeta } from "../components/ui";
import { pastEvents, seedNotifications } from "../data/seed";
import type { PlannrEvent } from "../data/types";
import { daysUntil, greeting, plainDate, TODAY } from "../lib/dates";
import { KIND_LABEL } from "../lib/intake";
import { communityReadiness, personalReadiness } from "../lib/metrics";
import { toast, useStore } from "../store/store";

function readiness(ev: PlannrEvent): number | undefined {
  if (ev.layout === "personal") return personalReadiness(ev, TODAY).overall;
  if (ev.layout === "community") return communityReadiness(ev).overall;
  return undefined;
}

export function Events() {
  usePageMeta("My events", { private: true });
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  if (!state.session.signedIn) return <Navigate to="/signin?next=/events" replace />;
  const live = state.events.filter((e) => !e.archived).sort((a, b) => a.date.localeCompare(b.date));
  const archived = state.events.filter((e) => e.archived);
  const notifications = seedNotifications();
  const unread = state.notificationsRead ? 0 : notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-dvh bg-paper">
      <Toran />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-8">
        <Logo to="/" />
        <div className="flex items-center gap-2">
          <Menu
            label="Notifications"
            button={({ open, toggle, id }) => (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => {
                  toggle();
                  if (!open) dispatch({ type: "readNotifications" });
                }}
              >
                Updates{unread ? ` · ${unread}` : ""}
              </button>
            )}
          >
            {(close) =>
              notifications.map((n) => (
                <MenuItem
                  key={n.id}
                  onSelect={() => {
                    close();
                    if (n.eventId) navigate(`/events/${n.eventId}`);
                  }}
                >
                  <span className="flex max-w-[300px] flex-col gap-0.5">
                    <span className="text-sm font-medium">{n.text}</span>
                    <span className="text-xs text-muted">{n.when}</span>
                  </span>
                </MenuItem>
              ))
            }
          </Menu>
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
                <span className="px-3 py-2 text-xs text-muted">
                  {state.session.name} · {state.session.plan}
                </span>
                <MenuDivider />
                <MenuItem
                  onSelect={() => {
                    close();
                    dispatch({ type: "resetDemo" });
                    dispatch({ type: "signIn" });
                    dispatch(toast("Demo data restored."));
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
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-muted">
              {greeting()}, {state.session.firstName}
            </span>
            <h1 className="font-serif text-[44px] leading-none">My events</h1>
          </div>
          <Link to="/new?fresh=1" className="btn btn-primary btn-lg">
            + New event
          </Link>
        </div>

        <section aria-label="Upcoming" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {live.map((ev) => {
            const r = readiness(ev);
            const days = daysUntil(ev.date);
            return (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink no-underline transition-shadow hover:shadow-[0_12px_32px_rgba(60,40,20,.10)]"
              >
                <div className="h-2" style={{ background: HUE_COLOR[ev.hue] }} />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow text-muted">{KIND_LABEL[ev.kind]}</span>
                    <span className="font-mono text-[10px] text-muted">{ev.role}</span>
                  </div>
                  <span className="font-serif text-[28px] leading-[1.05] group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {ev.name}
                  </span>
                  <span className="text-sm text-body">{ev.listMeta}</span>
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    {r !== undefined ? (
                      <>
                        <div className="flex justify-between text-xs font-medium">
                          <span>Readiness {Math.round(r * 100)}%</span>
                          <span className="text-muted">{days > 0 ? `${days} days to go` : "Today"}</span>
                        </div>
                        <Bar value={r} color="var(--color-peacock)" label={`${ev.name} readiness`} />
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-peacock">
                        No plan yet · Start planning →
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          <Link
            to="/new?fresh=1"
            className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line-2 p-6 text-center text-ink no-underline hover:border-ink"
          >
            <span className="font-serif text-[26px]">Plan something new</span>
            <span className="text-sm text-body">Describe it in a sentence. Plannr drafts the rest.</span>
          </Link>
        </section>

        <section aria-label="Past events" className="flex flex-col gap-3">
          <h2 className="font-serif text-[26px]">Past events</h2>
          <ul className="m-0 flex list-none flex-col rounded-2xl border border-line bg-surface p-0">
            {[
              ...archived.map((e) => ({
                id: e.id,
                name: e.name,
                date: e.date,
                summary: "Archived",
                live: true,
              })),
              ...pastEvents().map((p) => ({ ...p, live: false })),
            ].map((p, i) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm ${i ? "border-t border-sand-2" : ""}`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="flex items-center gap-3 text-body">
                  {p.summary} · {plainDate(p.date)}
                  {p.live && (
                    <button
                      type="button"
                      className="link text-xs"
                      onClick={() => dispatch({ type: "archiveEvent", eventId: p.id, archived: false })}
                    >
                      Restore
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
