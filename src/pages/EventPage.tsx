import { type FormEvent, lazy, Suspense, useState } from "react";
import { Link, Navigate, NavLink, useParams, useSearchParams } from "react-router";
import { AssistantPanel } from "../components/assistant";
import { AppShell } from "../components/shell";
import { TaskRow, TaskSheet, useEditable, useTaskToggle } from "../components/tasks";
import {
  Field,
  HUE_COLOR,
  Modal,
  Panel,
  Pill,
  Spinner,
  StatTile,
  toneText,
  usePageMeta,
} from "../components/ui";
import type { ActionId, CommunityEvent, Notice, PersonalEvent, PlannrEvent, Task } from "../data/types";
import { daysUntil, longDate, shortDate, TODAY } from "../lib/dates";
import { inr, inrShort, pct } from "../lib/format";
import { budgetTotals, communityReadiness, personalReadiness, tasksDone } from "../lib/metrics";
import { fundTotals, rsvpSummary, vendorSummary } from "../shared/derive";
import { ROLE_LABEL } from "../shared/types";
import { usePlanFreshness } from "../store/account";
import { toast, useStore } from "../store/store";
import { tabsFor } from "./tabs/list";

const TasksTab = lazy(() => import("./EventTabs").then((m) => ({ default: m.TasksTab })));
const HistoryTab = lazy(() => import("./EventTabs").then((m) => ({ default: m.HistoryTab })));
const PeopleTab = lazy(() => import("./EventTabs").then((m) => ({ default: m.PeopleTab })));

const GuestsTab = lazy(() => import("./tabs/GuestsTab").then((m) => ({ default: m.GuestsTab })));
const SiteTab = lazy(() => import("./tabs/SiteTab").then((m) => ({ default: m.SiteTab })));
const SettingsTab = lazy(() => import("./tabs/SettingsTab").then((m) => ({ default: m.SettingsTab })));
const MoneyTab = lazy(() => import("./tabs/MoneyTab").then((m) => ({ default: m.MoneyTab })));
const VendorsTab = lazy(() => import("./tabs/VendorsTab").then((m) => ({ default: m.VendorsTab })));
const DayTab = lazy(() => import("./tabs/DayTab").then((m) => ({ default: m.DayTab })));
const FundsTab = lazy(() => import("./tabs/CommunityTabs").then((m) => ({ default: m.FundsTab })));
const VolunteersTab = lazy(() => import("./tabs/CommunityTabs").then((m) => ({ default: m.VolunteersTab })));
const StallsTab = lazy(() => import("./tabs/CommunityTabs").then((m) => ({ default: m.StallsTab })));

/** /events/:id/:tab? — one event, with its overview, tasks, history and people. */
export function EventPage() {
  const { id, tab = "" } = useParams();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const ev = state.events.find((e) => e.id === id);
  const current = ev ? tabsFor(ev).find((t) => t.id === tab) : undefined;
  usePageMeta(ev ? (current?.id ? `${current.label} · ${ev.name}` : ev.name) : "Event not found", {
    private: true,
  });
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
  if (!current) return <Navigate to={`/events/${ev.id}`} replace />;
  return (
    <AppShell>
      <EventBar ev={ev} />
      {ev.layout === "empty" ? (
        <EmptyPlan ev={ev} />
      ) : tab === "" ? (
        <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_400px]">
          <main className="flex min-w-0 flex-col gap-6">
            <Hero ev={ev} />
            {ev.layout === "personal" ? (
              <Personal ev={ev} onOpenTask={setTask} />
            ) : (
              <Community ev={ev} onOpenTask={setTask} />
            )}
          </main>
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <AssistantPanel ev={ev} />
          </aside>
        </div>
      ) : (
        <Suspense fallback={<Loading />}>
          {tab === "tasks" && <TasksTab ev={ev} onOpenTask={setTask} />}
          {tab === "guests" && <GuestsTab ev={ev} />}
          {tab === "budget" && <MoneyTab ev={ev} />}
          {tab === "vendors" && <VendorsTab ev={ev} />}
          {tab === "day" && <DayTab ev={ev} />}
          {tab === "website" && <SiteTab ev={ev} />}
          {tab === "funds" && <FundsTab ev={ev} />}
          {tab === "volunteers" && <VolunteersTab ev={ev} />}
          {tab === "stalls" && <StallsTab ev={ev} />}
          {tab === "history" && <HistoryTab ev={ev} />}
          {tab === "people" && <PeopleTab ev={ev} />}
          {tab === "settings" && <SettingsTab ev={ev} />}
        </Suspense>
      )}
      <TaskSheet ev={ev} taskId={openTask} onClose={() => setTask(null)} />
    </AppShell>
  );
}

function EventBar({ ev }: { ev: PlannrEvent }) {
  const { state } = useStore();
  const editable = useEditable(ev);
  const remote = state.remote[ev.id];
  const tab = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold no-underline ${isActive ? "border-ink text-ink" : "border-transparent text-body hover:text-ink"}`;
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
          <nav aria-label="Event sections" className="flex gap-1 overflow-x-auto">
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
    <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-16 text-center">
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

// ---------------------------------------------------------------- personal

function Personal({ ev, onOpenTask }: { ev: PersonalEvent; onOpenTask: (id: string) => void }) {
  const r = personalReadiness(ev, TODAY);
  const t = budgetTotals(ev.budget);
  const rsvp = rsvpSummary(ev);
  const vendors = vendorSummary(ev);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Readiness"
          value={`${pct(r.overall, 1)}%`}
          sub={r.overdue ? `${r.overdue} overdue ${r.overdue === 1 ? "task" : "tasks"}` : ev.pace}
          bar={r.overall}
          color="var(--color-peacock)"
        />
        <StatTile
          label="Budget"
          value={inrShort(t.spent)}
          sub={`spent of ${inrShort(t.total)} · projected ${inrShort(t.projected)}`}
          bar={t.spent / Math.max(1, t.total)}
          color={t.over > 0 ? "var(--color-rust)" : "var(--color-leaf)"}
        />
        <StatTile
          label="Tasks"
          value={`${r.tasksDone}/${r.tasksTotal}`}
          sub={`${ev.tasks.list.filter((x) => !x.done).length} open on the list`}
          bar={r.tasks}
        />
        <StatTile
          label="Guests"
          value={`${rsvp.confirmed}`}
          sub={`confirmed of ${rsvp.total} · ${rsvp.pending} waiting`}
          bar={r.guests}
          color="var(--color-marigold)"
        />
      </div>
      <Notices ev={ev} />
      {ev.functions.length > 0 && (
        <Panel title="Functions">
          <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {ev.functions.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 rounded-xl bg-sand p-3">
                <span className="font-semibold">{f.label}</span>
                <span className="text-xs text-body">
                  {shortDate(f.date)}
                  {f.time ? ` · ${f.time}` : f.part ? ` · ${f.part}` : ""}
                </span>
                {f.place && <span className="text-xs text-muted">{f.place}</span>}
              </li>
            ))}
          </ol>
        </Panel>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Tasks ev={ev} onOpenTask={onOpenTask} />
        <Panel title="Vendors">
          <VendorGroup label="Booked" items={vendors.booked} tone="ok" />
          <VendorGroup label="In conversation" items={vendors.talking} tone="due" />
          <VendorGroup label="Still to book" items={vendors.needed} tone="idle" />
          {ev.vendors.note && vendors.talking.includes("Photography") && (
            <span className="text-xs text-rust-ink">{ev.vendors.note}</span>
          )}
        </Panel>
      </div>
      <Budget ev={ev} />
    </>
  );
}

function VendorGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "ok" | "due" | "idle";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow text-muted">
        {label} · {items.length}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((v) => (
            <Pill key={v} tone={tone}>
              {v}
            </Pill>
          ))
        ) : (
          <span className="text-sm text-muted">None</span>
        )}
      </div>
    </div>
  );
}

function Budget({ ev }: { ev: PersonalEvent }) {
  const t = budgetTotals(ev.budget);
  const max = Math.max(...ev.budget.categories.map((c) => Math.max(c.planned, c.projected ?? 0)), 1);
  return (
    <Panel
      title="Budget"
      aside={
        <span className={`text-sm font-semibold ${t.over > 0 ? "text-rust-ink" : "text-leaf-ink"}`}>
          {t.over > 0 ? `${inr(t.over)} over plan` : `${inr(-t.over)} headroom`}
        </span>
      }
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable) */}
      <section className="scroll-x" aria-label="Budget by category" tabIndex={0}>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Category</th>
              <th className="w-[38%] py-2 font-medium">Planned vs projected</th>
              <th className="py-2 text-right font-medium">Planned</th>
              <th className="py-2 text-right font-medium">Spent</th>
              <th className="py-2 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {ev.budget.categories.map((c) => {
              const proj = c.projected ?? c.planned;
              return (
                <tr key={c.id} className="border-t border-sand-2">
                  <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                  <td className="py-2.5 pr-3">
                    <div className="relative h-2 rounded-[2px] bg-sand-2">
                      <span
                        className="absolute inset-y-0 left-0 rounded-[2px]"
                        style={{ width: `${(c.planned / max) * 100}%`, background: "var(--color-line-2)" }}
                      />
                      <span
                        className="absolute inset-y-0 left-0 rounded-[2px]"
                        style={{
                          width: `${(Math.min(c.spent, proj) / max) * 100}%`,
                          background: proj > c.planned ? "var(--color-rust)" : "var(--color-leaf)",
                        }}
                      />
                      {proj > c.planned && (
                        <span
                          className="absolute inset-y-0 rounded-r-[2px] opacity-40"
                          style={{
                            left: `${(c.planned / max) * 100}%`,
                            width: `${((proj - c.planned) / max) * 100}%`,
                            background: "var(--color-rust)",
                          }}
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular">{inr(c.planned)}</td>
                  <td className="py-2.5 text-right tabular">{inr(c.spent)}</td>
                  <td className={`py-2.5 pl-3 text-xs ${toneText(c.tone)}`}>{c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <span className="text-xs text-muted">{ev.budget.source}</span>
    </Panel>
  );
}

// ---------------------------------------------------------------- shared

function Tasks({ ev, onOpenTask }: { ev: PersonalEvent | CommunityEvent; onOpenTask: (id: string) => void }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const { toggle, ticked } = useTaskToggle(ev);
  const [title, setTitle] = useState("");
  const [showDone, setShowDone] = useState(false);
  const settled = (t: Task) => t.done && !ticked.includes(t.id);
  const list = [...ev.tasks.list].sort(
    (a, b) => Number(settled(a)) - Number(settled(b)) || a.due.localeCompare(b.due),
  );
  const visible = showDone ? list : list.filter((t) => !settled(t));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const task: Task = {
      id: `u${Date.now().toString(36)}`,
      title: clean,
      who: "You",
      due: TODAY < ev.date ? TODAY : ev.date,
      done: false,
    };
    dispatch({ type: "addTask", eventId: ev.id, task });
    setTitle("");
  };
  return (
    <Panel
      title="Tasks"
      aside={
        <span className="flex gap-3">
          <button type="button" className="link text-xs" onClick={() => setShowDone((s) => !s)}>
            {showDone ? "Hide done" : `Show done (${ev.tasks.list.filter((t) => t.done).length})`}
          </button>
          <Link to={`/events/${ev.id}/tasks`} className="link text-xs">
            All tasks
          </Link>
        </span>
      }
    >
      <span className="text-xs text-muted">
        {tasksDone(ev.tasks)} of {ev.tasks.total} done across the whole plan
      </span>
      <ul className="m-0 flex list-none flex-col p-0">
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            ev={ev}
            task={t}
            editable={editable}
            onToggle={toggle}
            onOpen={(x) => onOpenTask(x.id)}
          />
        ))}
        {!visible.length && <li className="py-2 text-sm text-muted">Nothing open. Enjoy the quiet.</li>}
      </ul>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor={`new-task-${ev.id}`} className="sr-only">
            New task
          </label>
          <input
            id={`new-task-${ev.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task"
            className="field flex-1"
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!title.trim()}>
            Add
          </button>
        </form>
      )}
    </Panel>
  );
}

function Notices({ ev }: { ev: PersonalEvent | CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const [booking, setBooking] = useState(false);
  const [savings, setSavings] = useState(false);
  const open = ev.notices.filter((n) => n.status === "open");
  const closed = ev.notices.filter((n) => n.status !== "open");

  const resolve = (n: Notice, result: string, status: "done" | "dismissed" = "done") => {
    dispatch({ type: "resolveNotice", eventId: ev.id, noticeId: n.id, status, result });
    dispatch(toast(result, { type: "reopenNotice", eventId: ev.id, noticeId: n.id }));
  };

  const ask = (text: string) => {
    const box = document.getElementById(`ask-${ev.id}`) as HTMLTextAreaElement | null;
    if (!box) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(box, text);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.focus();
  };

  const run = (n: Notice, action: ActionId) => {
    switch (action) {
      case "acknowledge":
        return resolve(n, "Noted.");
      case "dismiss":
        return resolve(n, "Dismissed.", "dismissed");
      case "remind":
        return resolve(n, "Reminder set for Friday.");
      case "compare-photographers":
        return setBooking(true);
      case "open-savings":
        return setSavings(true);
      case "accept-overrun":
        if (ev.layout === "personal") {
          const cat = ev.budget.categories.find((c) => (c.projected ?? c.planned) > c.planned);
          if (cat)
            dispatch({
              type: "updateCategory",
              eventId: ev.id,
              categoryId: cat.id,
              patch: {
                planned: cat.projected ?? cat.planned,
                projected: undefined,
                tone: "ok",
                status: "Overrun accepted",
              },
            });
        }
        return resolve(n, "Overrun accepted: the plan now matches the quote.");
      case "review-guest-changes":
        dispatch({ type: "applyGuestGrowth", eventId: ev.id });
        return dispatch(toast("Catering, invitations and seating now plan for the new headcount."));
      case "order-cake":
        return dispatch({ type: "orderCake", eventId: ev.id });
      case "add-stars":
        return dispatch({ type: "addStars", eventId: ev.id });
      case "add-areca":
        return dispatch({ type: "addAreca", eventId: ev.id });
      case "draft-permit":
        return ask("Draft the police application for the loudspeaker permit");
      case "open-approvals":
        return document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth" });
      case "add-tip":
        return dispatch({ type: "addTip", eventId: ev.id });
    }
  };

  if (!ev.notices.length) return null;
  return (
    <section aria-label="Needs attention" className="flex flex-col gap-3">
      {open.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {open.map((n) => (
            <article
              key={n.id}
              className={`flex flex-col gap-2 rounded-2xl border p-4 ${n.tone === "ai" ? "card-ai" : n.tone === "warn" ? "border-rust-line bg-surface" : "border-line bg-surface"}`}
            >
              <Pill tone={n.tone === "info" ? "idle" : n.tone}>{n.label}</Pill>
              <span className="text-[15px] leading-[1.4] font-medium">{n.text}</span>
              {n.lines?.map((l) => (
                <span key={l} className="text-sm text-body">
                  · {l}
                </span>
              ))}
              {n.why && <span className="text-xs leading-[1.4] text-peacock">{n.why}</span>}
              <div className={`mt-1 flex-wrap gap-2 ${editable ? "flex" : "hidden"}`}>
                {n.primary && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => n.primary && run(n, n.primary.action)}
                  >
                    {n.primary.label}
                  </button>
                )}
                {n.secondary && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => n.secondary && run(n, n.secondary.action)}
                  >
                    {n.secondary.label}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {closed.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {closed.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-3 text-sm text-body">
              <span>
                <span className="text-leaf-ink">✓</span> {n.result ?? n.label}
              </span>
              {editable && (
                <button
                  type="button"
                  className="link text-xs"
                  onClick={() => dispatch({ type: "reopenNotice", eventId: ev.id, noticeId: n.id })}
                >
                  Reopen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ev.layout === "personal" && (
        <>
          <BookPhotographer ev={ev} open={booking} onClose={() => setBooking(false)} />
          <Savings ev={ev} open={savings} onClose={() => setSavings(false)} onAsk={ask} />
        </>
      )}
    </section>
  );
}

function BookPhotographer({ ev, open, onClose }: { ev: PersonalEvent; open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const [studio, setStudio] = useState("");
  const [price, setPrice] = useState("");
  const amount = Number(price.replace(/[^\d]/g, ""));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!studio.trim() || !amount) return;
    dispatch({ type: "bookPhotographer", eventId: ev.id, studio: studio.trim(), price: amount });
    dispatch(toast(`Booked ${studio.trim()} for ${inr(amount)}.`));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Book the photographer">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <p className="m-0 text-sm text-body">
          Which of your shortlisted studios did you choose? The budget, vendor list and task update together.
        </p>
        <Field label="Studio" htmlFor="studio">
          <input id="studio" className="field" value={studio} onChange={(e) => setStudio(e.target.value)} />
        </Field>
        <Field label="Package price (₹)" htmlFor="price">
          <input
            id="price"
            className="field"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2,40,000"
          />
        </Field>
        <button type="submit" className="btn btn-primary self-start" disabled={!studio.trim() || !amount}>
          Book {amount ? inr(amount) : ""}
        </button>
      </form>
    </Modal>
  );
}

function Savings({
  ev,
  open,
  onClose,
  onAsk,
}: {
  ev: PersonalEvent;
  open: boolean;
  onClose: () => void;
  onAsk: (text: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Ways to save">
      {ev.budget.savings.length ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {ev.budget.savings.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 rounded-xl bg-sand p-3.5">
              <span className="flex justify-between gap-3 font-semibold">
                {s.title}
                <span className="tabular text-leaf-ink">−{inr(s.amount)}</span>
              </span>
              <span className="text-sm text-body">{s.why}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-body">No savings ideas yet. Ask Plannr where the budget is tight.</p>
      )}
      <button
        type="button"
        className="btn btn-secondary self-start"
        onClick={() => {
          onClose();
          onAsk("Where are we over, and what would you cut first?");
        }}
      >
        Ask Plannr to compare
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------- community

function Community({ ev, onOpenTask }: { ev: CommunityEvent; onOpenTask: (id: string) => void }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const r = communityReadiness(ev);
  const f = fundTotals(ev);
  const { received, expected } = f;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Readiness"
          value={`${pct(r.overall, 1)}%`}
          sub={`${r.permitsDone} of ${r.permitsTotal} permits cleared`}
          bar={r.overall}
          color="var(--color-peacock)"
        />
        <StatTile
          label="Funds"
          value={inrShort(received)}
          sub={`received of ${inrShort(expected)} · ${inrShort(ev.funds.spent)} spent`}
          bar={r.funds}
          color="var(--color-leaf)"
        />
        <StatTile
          label="Volunteers"
          value={`${r.volunteersFilled}/${r.volunteersNeeded}`}
          sub="shift places filled"
          bar={r.volunteers}
          color="var(--color-marigold)"
        />
        <StatTile
          label="Passes"
          value={`${f.passes.issued}`}
          sub={`of ${f.passes.capacity} · ${f.stalls.booked}/${f.stalls.total} stalls booked`}
          bar={r.passes}
        />
      </div>
      <Notices ev={ev} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Tasks ev={ev} onOpenTask={onOpenTask} />
        <Panel title="Permits & bookings">
          <ul className="m-0 flex list-none flex-col p-0">
            {ev.permits.map((p) => (
              <li key={p.label} className="flex justify-between gap-3 border-t border-sand-2 py-2.5 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className={`text-xs ${toneText(p.tone)}`}>{p.status}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Funds" id="approvals">
        <ul className="m-0 flex list-none flex-col p-0">
          {f.sources.map((s) => (
            <li
              key={s.label}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-sand-2 py-2.5 text-sm"
            >
              <span className="font-medium">{s.label}</span>
              <span className="tabular">
                {inr(s.received)} <span className="text-muted">/ {inr(s.expected)}</span>
              </span>
              <span className={`col-span-2 text-xs ${toneText(s.tone)}`}>{s.note}</span>
            </li>
          ))}
        </ul>
        <span className="eyebrow mt-2 text-muted">Waiting for the treasurer</span>
        <ul className="m-0 flex list-none flex-col p-0">
          {ev.funds.approvals.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 border-t border-sand-2 py-2.5 text-sm"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{a.label}</span>
                <span className="text-xs text-muted">by {a.by}</span>
              </span>
              <span className="tabular">{inr(a.amount)}</span>
              {a.status === "pending" && !editable ? (
                <Pill tone="due">waiting</Pill>
              ) : a.status === "pending" ? (
                <span className="flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      dispatch({
                        type: "approveExpense",
                        eventId: ev.id,
                        approvalId: a.id,
                        status: "approved",
                      });
                      dispatch(toast(`Approved ${inr(a.amount)} for ${a.by}.`));
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      dispatch({
                        type: "approveExpense",
                        eventId: ev.id,
                        approvalId: a.id,
                        status: "declined",
                      })
                    }
                  >
                    Decline
                  </button>
                </span>
              ) : (
                <Pill tone={a.status === "approved" ? "ok" : "idle"}>{a.status}</Pill>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Shifts ev={ev} />
      <span className="text-xs text-muted">Event day: {longDate(ev.date)}</span>
    </>
  );
}

function Shifts({ ev }: { ev: CommunityEvent }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  return (
    <Panel title="Volunteer shifts">
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users must be able to scroll a wide table (WCAG scrollable-region-focusable) */}
      <section className="scroll-x" aria-label="Volunteer shifts by role and time" tabIndex={0}>
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-2 font-medium">Role</th>
              {ev.shifts.slots.map((s) => (
                <th key={s} className="py-2 font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ev.shifts.roles.map((role) => (
              <tr key={role.role} className="border-t border-sand-2 align-top">
                <td className="py-2.5 pr-3 font-medium">{role.role}</td>
                {role.slots.map((slot, i) => {
                  const gap = slot.need - slot.names.length;
                  const busy = new Set(ev.shifts.roles.flatMap((r) => r.slots[i]?.names ?? []));
                  const free = ev.volunteers.filter((v) => !busy.has(v));
                  return (
                    <td key={`${role.role}-${ev.shifts.slots[i]}`} className="py-2.5 pr-3">
                      <div className="flex flex-col gap-1">
                        <span>{slot.names.join(", ") || <span className="text-muted">—</span>}</span>
                        {gap > 0 && !editable && <span className="text-xs text-rust-ink">Needs {gap}</span>}
                        {gap > 0 && editable && (
                          <label className="flex items-center gap-1.5 text-xs text-rust-ink">
                            <span>Needs {gap}</span>
                            <select
                              className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs text-ink"
                              value=""
                              aria-label={`Assign a volunteer to ${role.role}, ${ev.shifts.slots[i]}`}
                              onChange={(e) =>
                                e.target.value &&
                                dispatch({
                                  type: "assignShift",
                                  eventId: ev.id,
                                  role: role.role,
                                  slot: i,
                                  name: e.target.value,
                                })
                              }
                            >
                              <option value="">Assign…</option>
                              {free.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Panel>
  );
}
