import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { TaskRow, useEditable, useTaskToggle } from "../components/tasks";
import { Field, Pill, Spinner } from "../components/ui";
import type { PlannrEvent, Task } from "../data/types";
import { api, inviteUrl } from "../lib/api";
import { addDays, TODAY } from "../lib/dates";
import { initials, timeAgo } from "../lib/format";
import { type HistoryEntry, type Member, ROLE_LABEL, type Role } from "../shared/types";
import { canEdit, toast, useStore } from "../store/store";

function TabPage({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">{eyebrow}</span>
          <h1 className="font-serif text-[40px] leading-none">{title}</h1>
        </div>
        {aside}
      </div>
      {children}
    </main>
  );
}

/** Shown in the demo, where nothing is shared and nothing is kept on a server. */
function NeedsAccount({ ev, title, children }: { ev: PlannrEvent; title: string; children: ReactNode }) {
  return (
    <TabPage eyebrow={ev.name} title={title}>
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface p-6">
        <p className="m-0 max-w-[560px] text-[15px] leading-normal text-body">{children}</p>
        <Link to="/signup" className="btn btn-primary">
          Create a free account
        </Link>
      </div>
    </TabPage>
  );
}

// ---------------------------------------------------------------- tasks

type Show = "open" | "done" | "all";

export function TasksTab({ ev, onOpenTask }: { ev: PlannrEvent; onOpenTask: (id: string) => void }) {
  const { dispatch } = useStore();
  const editable = useEditable(ev);
  const { toggle, ticked } = useTaskToggle(ev);
  const [show, setShow] = useState<Show>("open");
  const [who, setWho] = useState("");
  const [title, setTitle] = useState("");
  const tasks = ev.layout === "empty" ? [] : ev.tasks.list;
  const people = [...new Set(tasks.map((t) => t.who))].sort();
  const open = (t: Task) => !t.done || ticked.includes(t.id);
  const shown = tasks
    .filter((t) => (show === "all" ? true : show === "open" ? open(t) : t.done))
    .filter((t) => !who || t.who === who)
    .sort((a, b) => a.due.localeCompare(b.due));
  const week = addDays(TODAY, 7);
  const groups: { label: string; list: Task[] }[] =
    show === "done"
      ? [{ label: "Done", list: shown }]
      : [
          { label: "Overdue", list: shown.filter((t) => !t.done && t.due < TODAY) },
          { label: "This week", list: shown.filter((t) => !t.done && t.due >= TODAY && t.due <= week) },
          { label: "Later", list: shown.filter((t) => !t.done && t.due > week) },
          { label: "Done", list: shown.filter((t) => t.done) },
        ];

  const add = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    dispatch({
      type: "addTask",
      eventId: ev.id,
      task: {
        id: `u${Date.now().toString(36)}`,
        title: clean,
        who: who || "You",
        due: TODAY < ev.date ? TODAY : ev.date,
        done: false,
      },
    });
    setTitle("");
  };

  const done = tasks.filter((t) => t.done).length;
  return (
    <TabPage
      eyebrow={ev.name}
      title="Tasks"
      aside={
        <span className="text-sm text-body">
          {done} of {tasks.length} done
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="m-0 flex gap-1.5 border-0 p-0">
          <legend className="sr-only">Show</legend>
          {(["open", "done", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={show === s}
              className="chip chip-sm"
              onClick={() => setShow(s)}
            >
              {s === "open" ? "Open" : s === "done" ? "Done" : "All"}
            </button>
          ))}
        </fieldset>
        {people.length > 1 && (
          <label className="ml-auto flex items-center gap-2 text-sm text-body">
            Who
            <select
              className="field h-9 min-h-0 py-0 appearance-auto"
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {editable && (
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="tasks-new" className="sr-only">
            New task
          </label>
          <input
            id="tasks-new"
            className="field flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={who ? `Add a task for ${who}` : "Add a task"}
          />
          <button type="submit" className="btn btn-secondary" disabled={!title.trim()}>
            Add
          </button>
        </form>
      )}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <section
            key={g.label}
            aria-label={g.label}
            className="flex flex-col rounded-2xl border border-line bg-surface px-5 pt-3 pb-1"
          >
            <h2 className={`eyebrow pb-1 ${g.label === "Overdue" ? "text-rust-ink" : "text-muted"}`}>
              {g.label} · {g.list.length}
            </h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {g.list.map((t) => (
                <TaskRow
                  key={t.id}
                  ev={ev}
                  task={t}
                  editable={editable}
                  onToggle={toggle}
                  onOpen={(x) => onOpenTask(x.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      {!shown.length && (
        <p className="m-0 rounded-2xl border border-dashed border-line-2 p-8 text-center text-body">
          {show === "done" ? "Nothing ticked off yet." : "Nothing open here. Enjoy the quiet."}
        </p>
      )}
    </TabPage>
  );
}

// ---------------------------------------------------------------- history

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

export function HistoryTab({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch, sync } = useStore();
  const editable = useEditable(ev);
  const version = state.remote[ev.id]?.version;
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (state.mode !== "account") return;
    let live = true;
    // Refetched whenever the plan's version moves, by this person or anyone else.
    void version;
    api
      .history(ev.id)
      .then((h) => live && setList(h))
      .catch(() => live && setList((l) => l ?? []));
    return () => {
      live = false;
    };
  }, [ev.id, version, state.mode]);

  if (state.mode !== "account")
    return (
      <NeedsAccount ev={ev} title="History">
        With an account, every change to the plan is kept here: who made it, and when. Any change can be
        undone on its own, even after other changes have come in.
      </NeedsAccount>
    );

  const undo = async (entry: HistoryEntry) => {
    if (sync.has(ev.id)) {
      dispatch(toast("Saving your latest change first. Try again in a moment."));
      return;
    }
    setBusy(entry.id);
    try {
      const plan = await api.undo(ev.id, entry.id, entry.undone);
      dispatch({ type: "syncPlan", plan });
      dispatch(toast(`${entry.undone ? "Redone" : "Undone"}: ${entry.summary}`));
    } catch (e) {
      dispatch(toast((e as Error).message));
    }
    setBusy("");
  };

  let lastDay = "";
  return (
    <TabPage eyebrow={ev.name} title="History">
      <p className="m-0 max-w-[640px] text-body">
        Every change to the plan, newest first. Undo one and Plannr rebuilds the plan without it, keeping
        everything that came after.
      </p>
      {list === null ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading history" />
        </div>
      ) : !list.length ? (
        <p className="m-0 rounded-2xl border border-dashed border-line-2 p-8 text-center text-body">
          No changes yet. Tick off a task or adjust the budget and it shows up here.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col rounded-2xl border border-line bg-surface p-0">
          {list.map((h, i) => {
            const day = dayHeading(h.at);
            const heading = day !== lastDay;
            lastDay = day;
            return (
              <li key={h.id} className={`flex flex-col ${i ? "border-t border-sand-2" : ""}`}>
                {heading && <span className="eyebrow px-5 pt-4 text-muted">{day}</span>}
                <div className="flex items-start gap-3 px-5 py-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-[11px] font-semibold"
                  >
                    {initials(h.by ?? "?")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-sm font-medium ${h.undone ? "text-muted line-through" : ""}`}>
                      {h.summary}
                    </span>
                    <span className="text-xs text-muted">
                      {h.by ?? "Someone"} · {timeAgo(h.at)}
                      {h.undone && " · undone"}
                    </span>
                  </span>
                  {h.kind !== "action" ? (
                    <Pill tone="idle">{h.kind}</Pill>
                  ) : (
                    editable && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!!busy}
                        onClick={() => undo(h)}
                        aria-label={`${h.undone ? "Redo" : "Undo"} ${h.summary}`}
                      >
                        {busy === h.id ? "…" : h.undone ? "Redo" : "Undo"}
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </TabPage>
  );
}

// ---------------------------------------------------------------- people

const SIDES = ["Bride's side", "Groom's side", "Family", "Friends", "Volunteers"];
/** Committees name roles instead; "Treasurer" decides on expenses. */
const COMMITTEE = ["Treasurer", "Secretary", "President", "Volunteers"];

export function PeopleTab({ ev }: { ev: PlannrEvent }) {
  const { state, dispatch } = useStore();
  const me = state.account.user?.id;
  const role = state.remote[ev.id]?.role;
  const owner = role === "owner";
  const [members, setMembers] = useState<Member[] | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (state.mode !== "account") return;
    let live = true;
    void reload;
    api
      .members(ev.id)
      .then((m) => live && setMembers(m))
      .catch(() => live && setMembers((m) => m ?? []));
    return () => {
      live = false;
    };
  }, [ev.id, state.mode, reload]);

  if (state.mode !== "account")
    return (
      <NeedsAccount ev={ev} title="People">
        Plan together: invite family as co-planners who can change the plan, or let others follow along. Every
        change shows who made it.
      </NeedsAccount>
    );

  const change = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      dispatch(toast(done));
      setReload((r) => r + 1);
    } catch (e) {
      dispatch(toast((e as Error).message));
    }
  };

  return (
    <TabPage eyebrow={ev.name} title="People">
      <section
        aria-label="Who's planning"
        className="flex flex-col rounded-2xl border border-line bg-surface"
      >
        {members === null ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading people" />
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {members.map((m, i) => (
              <li
                key={m.userId}
                className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${i ? "border-t border-sand-2" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-peacock-tint text-xs font-semibold text-peacock-deep"
                >
                  {initials(m.name || "?")}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">
                    {m.name || "Unnamed"}
                    {m.userId === me && <span className="font-normal text-muted"> (you)</span>}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {m.guest ? "Guest" : m.email}
                    {m.side ? ` · ${m.side}` : ""}
                  </span>
                </span>
                {owner && m.role !== "owner" ? (
                  <span className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${m.userId}`}>
                      Role for {m.name}
                    </label>
                    <select
                      id={`role-${m.userId}`}
                      className="field h-9 min-h-0 py-0 text-sm appearance-auto"
                      value={m.role}
                      onChange={(e) =>
                        change(
                          () =>
                            api.updateMember(ev.id, m.userId, {
                              role: e.target.value as Exclude<Role, "owner">,
                            }),
                          `${m.name} is now ${ROLE_LABEL[e.target.value as Role].toLowerCase()}.`,
                        )
                      }
                    >
                      <option value="planner">{ROLE_LABEL.planner}</option>
                      <option value="viewer">{ROLE_LABEL.viewer}</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-rust-ink"
                      onClick={() => change(() => api.removeMember(ev.id, m.userId), `Removed ${m.name}.`)}
                    >
                      Remove
                    </button>
                  </span>
                ) : (
                  <Pill tone={m.role === "owner" ? "ok" : "idle"}>{ROLE_LABEL[m.role]}</Pill>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {canEdit(role) ? (
        <Invite ev={ev} />
      ) : (
        <p className="m-0 text-sm text-body">
          Only co-planners can invite people. Ask the owner if someone's missing.
        </p>
      )}
    </TabPage>
  );
}

function Invite({ ev }: { ev: PlannrEvent }) {
  const { dispatch } = useStore();
  const [role, setRole] = useState<Exclude<Role, "owner">>("planner");
  const [side, setSide] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await api.createInvite(ev.id, role, side.trim() || null);
      setLink(inviteUrl(token));
    } catch (err) {
      dispatch(toast((err as Error).message));
    }
    setBusy(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      dispatch(toast("Invite link copied."));
    } catch {
      dispatch(toast("Couldn't copy. Select the link and copy it yourself."));
    }
  };

  const message = `Join me in planning ${ev.name} on Plannr: ${link}`;
  return (
    <section
      aria-label="Invite people"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <h2 className="font-serif text-[24px]">Invite people</h2>
      <form onSubmit={create} className="flex flex-col gap-4">
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="label mb-2">They can</legend>
          <div className="flex flex-wrap gap-2">
            {(["planner", "viewer"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                className="chip"
                onClick={() => {
                  setRole(r);
                  setLink("");
                }}
              >
                {r === "planner" ? "Plan with you" : "Only view"}
              </button>
            ))}
          </div>
        </fieldset>
        <Field
          label={ev.layout === "community" ? "Committee role (optional)" : "Side (optional)"}
          htmlFor="invite-side"
          hint={
            ev.layout === "community"
              ? "Shows next to their name. Once someone is the Treasurer, only they or the owner approve expenses."
              : "Shows next to their name, so everyone knows who's who."
          }
        >
          <input
            id="invite-side"
            className="field"
            list="invite-sides"
            value={side}
            maxLength={60}
            onChange={(e) => {
              setSide(e.target.value);
              setLink("");
            }}
            placeholder={ev.layout === "community" ? "Treasurer" : "Groom's side"}
          />
          <datalist id="invite-sides">
            {(ev.layout === "community" ? COMMITTEE : SIDES).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        {!link && (
          <button type="submit" className="btn btn-primary self-start" disabled={busy}>
            {busy ? "Creating…" : "Create invite link"}
          </button>
        )}
      </form>
      {link && (
        <div className="flex flex-col gap-2.5 rounded-xl bg-sand p-4">
          <label htmlFor="invite-link" className="label">
            Invite link · works for 14 days
          </label>
          <input
            id="invite-link"
            className="field font-mono text-xs"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              Copy link
            </button>
            <a
              className="btn btn-outline btn-sm"
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
            >
              Share on WhatsApp
            </a>
          </div>
          <span className="text-xs text-muted">
            Anyone with this link can join as {ROLE_LABEL[role].toLowerCase()}
            {side.trim() ? ` on ${side.trim()}` : ""}. You can change their role or remove them here.
          </span>
        </div>
      )}
    </section>
  );
}
