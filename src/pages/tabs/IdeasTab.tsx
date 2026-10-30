import { type FormEvent, useState } from "react";
import { useEditable } from "../../components/tasks";
import { Pill } from "../../components/ui";
import type { Idea, PlannrEvent } from "../../data/types";
import { suggestIdeas } from "../../lib/ai";
import { addDays, TODAY } from "../../lib/dates";
import { inr, plural } from "../../lib/format";
import { deviceIdeas, ideaRecord, type PlannedEvent } from "../../lib/ideas";
import { findRecord, list } from "../../shared/records";
import { toast, useStore } from "../../store/store";
import { newId, Section, TabPage } from "./common";

const EFFORT: Record<NonNullable<Idea["effort"]>, string> = {
  low: "Easy",
  medium: "Some work",
  high: "A project",
};

const ORDER: Record<Idea["status"], number> = { idea: 0, planned: 1, dropped: 2 };

/** /events/:id/ideas — ideas picked for this event, each with its reason, and the board they're planned from. */
export function IdeasTab({ ev }: { ev: PlannrEvent }) {
  const editable = useEditable(ev);
  if (ev.layout === "empty") return null;
  return (
    <TabPage eyebrow={ev.name} title="Ideas">
      {editable && <Suggest ev={ev} />}
      <Board ev={ev} editable={editable} />
      {editable && <AddIdea ev={ev} />}
    </TabPage>
  );
}

/** Asks Gemini for ideas that fit this event; with no AI, the rules on the device answer instead. */
function Suggest({ ev }: { ev: PlannedEvent }) {
  const { dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const suggest = async () => {
    setBusy(true);
    setNote("");
    const fromAi = await suggestIdeas(ev);
    const found = fromAi ?? deviceIdeas(ev);
    setBusy(false);
    if (!found.length) {
      setNote("Nothing new to suggest for now. Add your own idea below.");
      return;
    }
    const categories = list(ev, "categories");
    for (const s of found)
      dispatch({
        type: "addRecord",
        eventId: ev.id,
        coll: "ideas",
        record: ideaRecord(s, categories, newId("i")),
      });
    setNote(
      fromAi
        ? `Added ${plural(found.length, "idea")} picked for this event.`
        : `Plannr's AI isn't reachable, so ${plural(found.length, "idea")} came from the rules on this device.`,
    );
    dispatch(toast(`Added ${plural(found.length, "idea")} to the board.`));
  };

  return (
    <Section label="Suggest ideas">
      <p className="m-0 max-w-[62ch] text-sm text-body">
        Plannr reads the month, the functions, the guest count, meals and budget lines, and suggests ideas
        that fit them, each with the reason. Guests go as counts; no names or numbers leave this page.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={suggest} disabled={busy} aria-busy={busy}>
          {busy ? "Thinking of ideas…" : "Suggest ideas"}
        </button>
        <p role="status" className="m-0 text-sm text-muted">
          {note}
        </p>
      </div>
    </Section>
  );
}

function Board({ ev, editable }: { ev: PlannedEvent; editable: boolean }) {
  const { dispatch } = useStore();
  const ideas = [...list(ev, "ideas")].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const categories = list(ev, "categories");

  /** Planning an idea adds its task and its cost to the budget line it belongs to. */
  const plan = (i: Idea) => {
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "ideas", id: i.id, patch: { status: "planned" } });
    dispatch({
      type: "addTask",
      eventId: ev.id,
      task: {
        id: newId("t"),
        title: `Arrange: ${i.title}`,
        who: "You",
        due: addDays(ev.date, -14) > TODAY ? addDays(ev.date, -14) : ev.date,
        done: false,
        note: i.note ?? "From the ideas board",
      },
    });
    const c = i.categoryId ? findRecord(ev, "categories", i.categoryId) : undefined;
    if (c && i.cost)
      dispatch({
        type: "updateRecord",
        eventId: ev.id,
        coll: "categories",
        id: c.id,
        patch: { projected: (c.projected ?? c.planned) + i.cost },
      });
    dispatch(
      toast(`Planned: ${i.title}${c && i.cost ? `. ${c.name} now includes ${inr(i.cost)} for it.` : "."}`),
    );
  };

  const drop = (i: Idea) =>
    dispatch({ type: "updateRecord", eventId: ev.id, coll: "ideas", id: i.id, patch: { status: "dropped" } });

  return (
    <Section title="Ideas board">
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {ideas.map((i) => (
          <li
            key={i.id}
            className={`flex flex-col gap-1.5 rounded-xl border p-3 ${i.status === "dropped" ? "border-line opacity-60" : "border-line bg-paper"}`}
          >
            <span className="text-sm font-semibold">{i.title}</span>
            {i.note && <span className="text-sm text-body">{i.note}</span>}
            {i.because && (
              <span className="text-xs text-body">
                <span className="font-semibold">Why this: </span>
                {i.because}
              </span>
            )}
            <span className="text-xs text-muted">
              {[
                i.cost ? `About ${inr(i.cost)}` : undefined,
                i.effort ? EFFORT[i.effort] : undefined,
                categories.find((c) => c.id === i.categoryId)?.name,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              <IdeaStatus idea={i} editable={editable} onPlan={() => plan(i)} onDrop={() => drop(i)} />
            </span>
          </li>
        ))}
        {!ideas.length && (
          <li className="text-sm text-muted">
            No ideas yet. Ask Plannr for some that fit this event, or add your own below.
          </li>
        )}
      </ul>
    </Section>
  );
}

/** Planned or dropped, or (for planners) the buttons that decide it. */
function IdeaStatus({
  idea,
  editable,
  onPlan,
  onDrop,
}: {
  idea: Idea;
  editable: boolean;
  onPlan: () => void;
  onDrop: () => void;
}) {
  if (idea.status === "planned") return <Pill tone="ok">in the plan</Pill>;
  if (idea.status === "dropped") return <Pill tone="idle">dropped</Pill>;
  if (!editable) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        aria-label={`Plan it: ${idea.title}`}
        onClick={onPlan}
      >
        Plan it
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-label={`Drop: ${idea.title}`}
        onClick={onDrop}
      >
        Drop
      </button>
    </>
  );
}

function AddIdea({ ev }: { ev: PlannedEvent }) {
  const { dispatch } = useStore();
  const categories = list(ev, "categories");
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [effort, setEffort] = useState<Idea["effort"]>("low");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    dispatch({
      type: "addRecord",
      eventId: ev.id,
      coll: "ideas",
      record: {
        id: newId("i"),
        title: title.trim(),
        status: "idea",
        effort,
        ...(Number(cost) > 0 ? { cost: Number(cost) } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
    });
    setTitle("");
    setCost("");
  };

  return (
    <Section title="Add your own">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_120px_140px_auto]">
        <label htmlFor="idea-title" className="sr-only">
          Idea
        </label>
        <input
          id="idea-title"
          className="field"
          placeholder="An idea"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label htmlFor="idea-cost" className="sr-only">
          Cost
        </label>
        <input
          id="idea-cost"
          className="field"
          inputMode="numeric"
          placeholder="₹ cost"
          value={cost}
          onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
        />
        <label htmlFor="idea-effort" className="sr-only">
          Effort
        </label>
        <select
          id="idea-effort"
          className="field appearance-auto"
          value={effort}
          onChange={(e) => setEffort(e.target.value as Idea["effort"])}
        >
          <option value="low">Easy</option>
          <option value="medium">Some work</option>
          <option value="high">A project</option>
        </select>
        {categories.length > 0 && (
          <>
            <label htmlFor="idea-cat" className="sr-only">
              Budget line
            </label>
            <select
              id="idea-cat"
              className="field appearance-auto sm:col-span-3"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="submit" className="btn btn-secondary" disabled={!title.trim()}>
          Add idea
        </button>
      </form>
    </Section>
  );
}
