import { type ComponentType, lazy, Suspense, useEffect, useRef } from "react";
import { Link, Navigate, NavLink, useLocation, useParams, useSearchParams } from "react-router";
import { AssistantPanel } from "../components/assistant";
import { AppShell } from "../components/shell";
import { TaskSheet, useEditable } from "../components/tasks";
import { HUE_COLOR, Spinner, usePageMeta } from "../components/ui";
import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../data/types";
import { daysUntil } from "../lib/dates";
import { ROLE_LABEL } from "../shared/types";
import { usePlanFreshness } from "../store/account";
import { useStore } from "../store/store";
import { Community } from "./overview/Community";
import { Personal } from "./overview/Personal";
import { tabsFor } from "./tabs/list";

const TimelineTab = lazy(() => import("./tabs/TimelineTab").then((m) => ({ default: m.TimelineTab })));
const IdeasTab = lazy(() => import("./tabs/IdeasTab").then((m) => ({ default: m.IdeasTab })));
const HistoryTab = lazy(() => import("./EventTabs").then((m) => ({ default: m.HistoryTab })));
const PeopleTab = lazy(() => import("./EventTabs").then((m) => ({ default: m.PeopleTab })));

const GuestsTab = lazy(() => import("./tabs/GuestsTab").then((m) => ({ default: m.GuestsTab })));
const SiteTab = lazy(() => import("./tabs/SiteTab").then((m) => ({ default: m.SiteTab })));
const SettingsTab = lazy(() => import("./tabs/SettingsTab").then((m) => ({ default: m.SettingsTab })));
const MoneyTab = lazy(() => import("./tabs/MoneyTab").then((m) => ({ default: m.MoneyTab })));
const VendorsTab = lazy(() => import("./tabs/VendorsTab").then((m) => ({ default: m.VendorsTab })));
const DayTab = lazy(() => import("./tabs/DayTab").then((m) => ({ default: m.DayTab })));
const FundsTab = lazy(() => import("./tabs/FundsTab").then((m) => ({ default: m.FundsTab })));
const VolunteersTab = lazy(() => import("./tabs/VolunteersTab").then((m) => ({ default: m.VolunteersTab })));
const StallsTab = lazy(() => import("./tabs/StallsTab").then((m) => ({ default: m.StallsTab })));

type TabProps = { ev: PlannrEvent; onOpenTask: (id: string) => void };

/** Each section's screen, loaded when it's first opened. The overview ("") is part of this page. */
const TAB_SCREENS: Record<string, ComponentType<TabProps>> = {
  timeline: TimelineTab,
  guests: GuestsTab,
  budget: MoneyTab,
  vendors: VendorsTab,
  ideas: IdeasTab,
  day: DayTab,
  website: SiteTab,
  funds: FundsTab,
  volunteers: VolunteersTab,
  stalls: StallsTab,
  history: HistoryTab,
  people: PeopleTab,
  settings: SettingsTab,
};

/** "Budget · Priya & Arjun's wedding", the event's name on its overview, or "Event not found". */
function pageTitle(ev: PlannrEvent | undefined, tab: { id: string; label: string } | undefined): string {
  if (!ev) return "Event not found";
  return tab?.id ? `${tab.label} · ${ev.name}` : ev.name;
}

/** /events/:id/:tab? — one event, with its overview, timeline, budget, vendors, ideas and people. */
export function EventPage() {
  const { id, tab = "" } = useParams();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const ev = state.events.find((e) => e.id === id);
  const current = ev ? tabsFor(ev).find((t) => t.id === tab) : undefined;
  usePageMeta(pageTitle(ev, current), { private: true });
  usePlanFreshness(id);
  const openTask = params.get("task");
  const setTask = (taskId: string | null) =>
    setParams(
      (p) => {
        if (taskId) p.set("task", taskId);
        else p.delete("task");
        return p;
      },
      { replace: !taskId },
    );

  if (!ev) {
    // An account's plans may still be on their way from the server.
    const loading = state.mode === "account" && state.account.status === "unknown";
    return <AppShell>{loading ? <Loading /> : <Missing />}</AppShell>;
  }
  // The timeline used to be called Tasks; old links and bookmarks still land on it.
  if (tab === "tasks")
    return <Navigate to={`/events/${ev.id}/timeline${params.size ? `?${params}` : ""}`} replace />;
  if (!current) return <Navigate to={`/events/${ev.id}`} replace />;
  const Screen = TAB_SCREENS[tab];
  return (
    <AppShell>
      <EventBar ev={ev} />
      {ev.layout === "empty" && <EmptyPlan ev={ev} />}
      {ev.layout !== "empty" && tab === "" && <Overview ev={ev} onOpenTask={setTask} />}
      {ev.layout !== "empty" && Screen && (
        <Suspense fallback={<Loading />}>
          <Screen ev={ev} onOpenTask={setTask} />
        </Suspense>
      )}
      <TaskSheet ev={ev} taskId={openTask} onClose={() => setTask(null)} />
    </AppShell>
  );
}

/** The overview: the plan at a glance beside the assistant. */
function Overview({
  ev,
  onOpenTask,
}: {
  ev: PersonalEvent | CommunityEvent;
  onOpenTask: (id: string) => void;
}) {
  return (
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pt-6 pb-24 sm:px-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:pb-6">
      <main id="main" className="flex min-w-0 flex-col gap-6">
        <Hero ev={ev} />
        {ev.layout === "personal" ? (
          <Personal ev={ev} onOpenTask={onOpenTask} />
        ) : (
          <Community ev={ev} onOpenTask={onOpenTask} />
        )}
      </main>
      <aside id="assistant" className="scroll-mt-4 xl:sticky xl:top-4 xl:self-start">
        <AssistantPanel ev={ev} />
      </aside>
      {/* On narrower screens the assistant sits below the overview: one tap brings it up. */}
      <button
        type="button"
        className="btn btn-primary fixed right-4 z-30 shadow-[0_8px_24px_rgba(20,10,5,.25)] xl:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        onClick={() => {
          document.getElementById("assistant")?.scrollIntoView({ behavior: "smooth", block: "start" });
          window.setTimeout(
            () => document.getElementById(`ask-${ev.id}`)?.focus({ preventScroll: true }),
            400,
          );
        }}
      >
        ◆ Ask Plannr
      </button>
    </div>
  );
}

function EventBar({ ev }: { ev: PlannrEvent }) {
  const { state } = useStore();
  const editable = useEditable(ev);
  const remote = state.remote[ev.id];
  const tab = ({ isActive }: { isActive: boolean }) =>
    `-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold no-underline ${isActive ? "border-ink text-ink" : "border-transparent text-body hover:text-ink"}`;
  // On a phone the sections scroll sideways: keep the one you're on in view.
  const tabsRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-centre whenever the section changes
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const bar = tabsRef.current;
    if (active && bar) bar.scrollLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 pt-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link to="/events" className="link text-body">
            ← My events
          </Link>
          <span aria-hidden="true" className="text-line-2">
            /
          </span>
          <span className="font-semibold">{ev.name}</span>
          <span className="font-mono text-[11px] text-muted">
            {remote ? `${ROLE_LABEL[remote.role]}${remote.side ? ` · ${remote.side}` : ""}` : ev.role}
          </span>
        </div>
        {ev.layout !== "empty" && (
          <nav aria-label="Event sections" ref={tabsRef} className="flex gap-1 overflow-x-auto">
            {tabsFor(ev).map((t) => (
              <NavLink key={t.id} to={`/events/${ev.id}${t.id ? `/${t.id}` : ""}`} end className={tab}>
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
      {!editable && (
        <p className="m-0 border-t border-line bg-peacock-wash px-4 py-2 text-center text-[13px] text-body sm:px-8">
          You can view this plan and follow along. Ask the owner to make you a co-planner to change it.
        </p>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label="Loading" />
    </div>
  );
}

function Missing() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-serif text-4xl">We couldn't find that event</h1>
      <p className="m-0 max-w-[420px] text-body">
        It may have been removed, or it's shared with a different account than the one you're signed in to.
      </p>
      <Link to="/events" className="btn btn-primary">
        Back to my events
      </Link>
    </div>
  );
}

function EmptyPlan({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  return (
    <main id="main" className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-16 text-center">
      <span className="eyebrow text-muted">{ev.eyebrow}</span>
      <h1 className="font-serif text-[44px] leading-[1.05]">{ev.name}</h1>
      <p className="m-0 text-body">
        {editable
          ? "No plan yet. Describe the day in a sentence and Plannr will draft the budget, tasks and vendors."
          : "No plan yet. It shows up here as soon as a co-planner drafts one."}
      </p>
      {editable && (
        <Link to={`/new?event=${ev.id}`} className="btn btn-primary btn-lg self-center">
          Plan it with Plannr
        </Link>
      )}
    </main>
  );
}

function Hero({ ev }: { ev: PersonalEvent | CommunityEvent }) {
  const days = daysUntil(ev.date);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="h-2" style={{ background: HUE_COLOR[ev.hue] }} />
      <div className="flex flex-wrap items-end justify-between gap-6 p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="eyebrow text-muted">{ev.eyebrow}</span>
          <h1 className="font-serif text-[40px] leading-[1.05] sm:text-[48px]">{ev.name}</h1>
          <span className="text-sm text-body">{ev.countdown.line}</span>
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <span className="font-serif text-[56px] leading-none tabular">{days > 0 ? days : "Today"}</span>
          <span className="eyebrow text-muted">
            {days > 0 ? `days · ${ev.countdown.label}` : ev.countdown.label}
          </span>
        </div>
      </div>
    </section>
  );
}
