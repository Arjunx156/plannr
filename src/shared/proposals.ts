import type { AiProposal, PlannrEvent } from "../data/types";
import { addDays } from "../lib/dates";
import { describeAction, type EventAction } from "./engine";
import { findRecord, functionsOf } from "./records";
import { genericRipple, headcountRipple, moveFunctionRipple, type Ripple } from "./ripple";

/**
 * The assistant proposes changes in a small vocabulary; this turns each into plan changes,
 * checked against the plan as it is now. A proposal that names a task, function or budget
 * line the plan doesn't have is dropped, never guessed at.
 */

let seq = 0;
const id = (prefix: string) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function proposalActions(ev: PlannrEvent, p: AiProposal, today: string): EventAction[] {
  if (ev.layout === "empty") return [];
  const eventId = ev.id;
  switch (p.kind) {
    case "addTask": {
      const soon = addDays(today, 7);
      const due = p.due && p.due <= ev.date ? p.due : soon < ev.date ? soon : ev.date;
      return p.title
        ? [
            {
              type: "addTask",
              eventId,
              task: {
                id: id("ai"),
                title: p.title,
                who: p.who ?? "You",
                due,
                done: false,
                ...(p.fnId && functionsOf(ev).some((f) => f.id === p.fnId) ? { fn: p.fnId } : {}),
              },
            },
          ]
        : [];
    }
    case "moveTask": {
      const t = ev.tasks.list.find((x) => x.id === p.taskId);
      return t && p.due && p.due !== t.due
        ? [{ type: "updateTask", eventId, taskId: t.id, patch: { due: p.due } }]
        : [];
    }
    case "completeTask": {
      const t = ev.tasks.list.find((x) => x.id === p.taskId);
      return t && !t.done ? [{ type: "toggleTask", eventId, taskId: t.id }] : [];
    }
    case "setHeadcount":
      return ev.layout === "personal" && p.guests && p.guests !== ev.guests
        ? [{ type: "setHeadcount", eventId, guests: p.guests }]
        : [];
    case "setBudgetLine": {
      const c = p.categoryId ? findRecord(ev, "categories", p.categoryId) : undefined;
      return c && p.amount !== undefined && p.amount !== c.planned
        ? [{ type: "updateRecord", eventId, coll: "categories", id: c.id, patch: { planned: p.amount } }]
        : [];
    }
    case "remember":
      return p.text
        ? [{ type: "addRecord", eventId, coll: "memory", record: { id: id("mem"), text: p.text } }]
        : [];
    case "announce":
      return p.text
        ? [
            {
              type: "addRecord",
              eventId,
              coll: "announcements",
              record: { id: id("an"), at: "", text: p.text },
            },
          ]
        : [];
    case "moveFunction": {
      const f = functionsOf(ev).find((x) => x.id === p.fnId);
      return f && p.date && p.date !== f.date
        ? [{ type: "updateRecord", eventId, coll: "functions", id: f.id, patch: { date: p.date } }]
        : [];
    }
    case "addChecklist":
      return p.label
        ? [
            {
              type: "addRecord",
              eventId,
              coll: "checklist",
              record: {
                id: id("ck"),
                label: p.label,
                done: false,
                ...(p.fnId && functionsOf(ev).some((f) => f.id === p.fnId) ? { fnId: p.fnId } : {}),
              },
            },
          ]
        : [];
  }
}

/** The preview for what the assistant proposed, with every connected change. */
export function proposalRipple(ev: PlannrEvent, proposals: AiProposal[], today: string): Ripple | undefined {
  const [only] = proposals;
  if (proposals.length === 1 && only) {
    // The richer previews: a headcount moves catering and favours; a function moves its tasks.
    if (only.kind === "setHeadcount" && only.guests && ev.layout === "personal" && only.guests !== ev.guests)
      return headcountRipple(ev, only.guests);
    if (only.kind === "moveFunction" && only.fnId && only.date) {
      const r = moveFunctionRipple(ev, only.fnId, only.date);
      return r.lines.length ? r : undefined;
    }
  }
  const actions = proposals.flatMap((p) => proposalActions(ev, p, today));
  if (!actions.length) return undefined;
  return genericRipple(
    ev,
    actions.length === 1 ? "Proposed change" : `${actions.length} proposed changes`,
    actions,
    (a) => describeAction(a, ev),
  );
}
