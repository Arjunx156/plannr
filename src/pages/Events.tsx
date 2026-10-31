import { useState } from "react";
import { Link } from "react-router";
import { usePageMeta } from "../components/pageMeta";
import { AppShell } from "../components/shell";
import { Bar, HUE_COLOR } from "../components/ui";
import { pastEvents } from "../data/seed";
import type { PlannrEvent } from "../data/types";
import { ApiError, api } from "../lib/api";
import { daysUntil, greeting, plainDate, TODAY } from "../lib/dates";
import { communityReadiness, personalReadiness } from "../lib/metrics";
import { KIND_LABEL } from "../lib/profileRows";
import { ROLE_LABEL } from "../shared/types";
import { toast, useStore } from "../store/store";
import { TemplatePicker } from "./tabs/planTemplates";

function readiness(ev: PlannrEvent): number | undefined {
  if (ev.layout === "personal") return personalReadiness(ev, TODAY).overall;
  if (ev.layout === "community") return communityReadiness(ev).overall;
  return undefined;
}

export function Events() {
  usePageMeta("My events", { private: true });
  const { state, dispatch } = useStore();
  const [picking, setPicking] = useState(false);
  const live = state.events.filter((e) => !e.archived).sort((a, b) => a.date.localeCompare(b.date));
  const archived = state.events.filter((e) => e.archived);
  const past = [
    ...archived.map((e) => ({ id: e.id, name: e.name, date: e.date, summary: "Archived", live: true })),
    ...(state.mode === "demo" ? pastEvents().map((p) => ({ ...p, live: false })) : []),
  ];

  return (
    <AppShell>
      <main id="main" className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-muted">
              {greeting()}, {state.session.firstName}
            </span>
            <h1 className="font-serif text-[44px] leading-none">My events</h1>
          </div>
          <span className="flex flex-wrap gap-2">
            {state.mode === "account" && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => setPicking(true)}>
                From a template
              </button>
            )}
            <Link to="/new?fresh=1" className="btn btn-primary btn-lg">
              + New event
            </Link>
          </span>
        </div>
        <TemplatePicker open={picking} onClose={() => setPicking(false)} />

        {state.mode === "account" && state.localImports.length > 0 && <Imports />}

        <section aria-label="Upcoming" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {live.map((ev) => {
            const r = readiness(ev);
            const days = daysUntil(ev.date);
            const remote = state.remote[ev.id];
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
                    <span className="font-mono text-xs text-muted">
                      {remote
                        ? `${ROLE_LABEL[remote.role]}${remote.side ? ` · ${remote.side}` : ""}`
                        : ev.role}
                    </span>
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
            <span className="font-serif text-[26px]">
              {live.length > 0 ? "Plan something new" : "Plan your first event"}
            </span>
            <span className="text-sm text-body">Describe it in a sentence. Plannr drafts the rest.</span>
          </Link>
        </section>

        {past.length > 0 && (
          <section aria-label="Past events" className="flex flex-col gap-3">
            <h2 className="font-serif text-[26px]">Past events</h2>
            <ul className="m-0 flex list-none flex-col rounded-2xl border border-line bg-surface p-0">
              {past.map((p, i) => (
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
        )}
      </main>
    </AppShell>
  );
}

/** Plans made on this device before signing in, offered to the account once. */
function Imports() {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const list = state.localImports;
  const save = async () => {
    setBusy(true);
    let saved = 0;
    for (const ev of list) {
      try {
        dispatch({ type: "syncPlan", plan: await api.createPlan(ev) });
        dispatch({ type: "dropImport", id: ev.id });
        saved += 1;
      } catch (e) {
        // Already saved from another tab: nothing left to do for this one.
        if (e instanceof ApiError && e.status === 409) dispatch({ type: "dropImport", id: ev.id });
      }
    }
    setBusy(false);
    dispatch(
      toast(
        saved ? `Saved ${saved} ${saved === 1 ? "plan" : "plans"} to your account.` : "Nothing new to save.",
      ),
    );
  };
  return (
    <section
      aria-label="Plans on this device"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-peacock-line bg-peacock-wash p-4"
    >
      <span className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span className="font-semibold">
          {list.length === 1 ? `“${list[0]?.name}” is` : `${list.length} plans are`} only on this device
        </span>
        <span className="text-body">
          You made {list.length === 1 ? "it" : "them"} before signing in. Save to keep{" "}
          {list.length === 1 ? "it" : "them"} with your account.
        </span>
      </span>
      <span className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save to my account"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => {
            for (const ev of list) dispatch({ type: "dropImport", id: ev.id });
          }}
        >
          Discard
        </button>
      </span>
    </section>
  );
}
