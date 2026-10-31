import type { AiProposal, Message } from "../data/messageTypes";
import type { PlannrEvent } from "../data/types";
import { fundTotals } from "../shared/balances";
import { rsvpSummary } from "../shared/derive";
import { isRecord } from "../shared/guards";
import { aiEnabled, post } from "./ai";
import { fromServer } from "./api";
import { TODAY } from "./dates";
import { budgetTotals, communityReadiness, personalReadiness, settle } from "./metrics";

// ---------------------------------------------------------------- assistant

/** The numbers the assistant should quote, computed here so the model never does arithmetic. */
export function eventFacts(ev: PlannrEvent): Record<string, unknown> {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  if (ev.layout === "personal") {
    const t = budgetTotals(ev.budget);
    const r = personalReadiness(ev, TODAY);
    return {
      today: TODAY,
      readiness: {
        overall: pct(r.overall),
        tasks: `${pct(r.tasks)} (${r.tasksDone} of ${r.tasksTotal} done, ${r.overdue} overdue)`,
        vendors: `${pct(r.vendors)} (${r.vendorsBooked} of ${r.vendorsTotal} booked)`,
        guests: `${pct(r.guests)} (${r.guestsConfirmed} of ${rsvpSummary(ev).total} confirmed)`,
        budgetHealth: pct(r.budget),
        weights: "tasks 30%, guests 30%, vendors 20%, budget 20%",
      },
      budget: {
        total: t.total,
        planned: t.planned,
        spent: t.spent,
        remaining: t.remaining,
        projected: t.projected,
        overPlan: t.over,
        overCategories: ev.budget.categories
          .filter((c) => (c.projected ?? c.planned) > c.planned)
          .map((c) => ({ name: c.name, by: (c.projected ?? c.planned) - c.planned })),
      },
      split: ev.budget.split ? settle(ev.budget.split, t.spent) : undefined,
      openTasks: ev.tasks.list.filter((x) => !x.done).length,
    };
  }
  if (ev.layout === "community") {
    const r = communityReadiness(ev);
    return {
      today: TODAY,
      readiness: {
        overall: pct(r.overall),
        tasks: `${r.tasksDone} of ${ev.tasks.total} done`,
        permits: `${r.permitsDone} of ${r.permitsTotal} cleared`,
        volunteers: `${r.volunteersFilled} of ${r.volunteersNeeded} shift places filled`,
        passes: `${fundTotals(ev).passes.issued} of ${ev.passes.capacity}`,
        stalls: `${fundTotals(ev).stalls.booked} of ${ev.stalls.total}`,
      },
      funds: {
        received: fundTotals(ev).received,
        expected: fundTotals(ev).expected,
        spent: ev.funds.spent,
        budget: ev.funds.budget,
        pendingApprovals: ev.funds.approvals.filter((a) => a.status === "pending").length,
      },
    };
  }
  return { today: TODAY, note: "No plan yet" };
}
/** The event without UI-only fields and the chat itself, to keep the prompt small. */
function compactEvent(ev: PlannrEvent): unknown {
  if (ev.layout === "empty") return ev;
  const { assistant: _a, home: _h, ...rest } = ev;
  if (rest.layout === "personal") {
    const { people: _p, ...personal } = rest;
    return personal;
  }
  return rest;
}

/** The assistant's answer: its text, where it came from, and any changes it proposes. */
export interface AssistantAnswer {
  text: string;
  source?: string;
  translation?: string;
  /** Changes it proposes; nothing applies until the planner approves the preview. */
  actions?: AiProposal[];
}
/** Earlier messages sent with a question, for context. */
const HISTORY_TURNS = 12;
/** How long the browser waits for an answer, streamed or not. */
const ANSWER_TIMEOUT_MS = 20000;
const STREAM_TIMEOUT_MS = 25000;
/** What the assistant routes receive: the question, the live plan, its computed facts and recent turns. */
function assistantBody(ev: PlannrEvent, thread: Message[], text: string, lang: string | undefined) {
  return {
    text,
    lang,
    today: TODAY,
    event: compactEvent(ev),
    facts: eventFacts(ev),
    history: thread.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, text: m.text })),
  };
}

/** The assistant's whole answer in one response. */
export function askAssistant(
  ev: PlannrEvent,
  thread: Message[],
  text: string,
  lang?: string,
): Promise<AssistantAnswer | undefined> {
  return post<AssistantAnswer>("assistant", assistantBody(ev, thread, text, lang), ANSWER_TIMEOUT_MS);
}
/** One server-sent event out of a buffer, or undefined when it isn't complete yet. */
function nextEvent(buffer: string): { event: string; data: string; rest: string } | undefined {
  const end = buffer.indexOf("\n\n");
  if (end < 0) return undefined;
  let event = "message";
  const data: string[] = [];
  for (const line of buffer.slice(0, end).split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return { event, data: data.join("\n"), rest: buffer.slice(end + 2) };
}
/** How a streamed answer ended: finished, or failed after showing some text or none. */
type StreamOutcome = { kind: "done"; answer: AssistantAnswer } | { kind: "failed"; shown: boolean };

/** Opens the streamed route; undefined when the server or a proxy can't stream. */
async function openAssistantStream(body: unknown): Promise<ReadableStream<Uint8Array> | undefined> {
  try {
    const res = await fetch("/api/ai/assistant/stream", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    });
    const streams = res.ok && res.headers.get("content-type")?.includes("text/event-stream");
    return streams ? (res.body ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

function streamText(data: string): string | undefined {
  const chunk: unknown = JSON.parse(data);
  return isRecord(chunk) && typeof chunk["text"] === "string" ? chunk["text"] : undefined;
}

// Each complete server-sent event in the stream, in order.
async function* sseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    buffer += decoder.decode(r.value, { stream: true });
    for (let e = nextEvent(buffer); e; e = nextEvent(buffer)) {
      buffer = e.rest;
      yield e;
    }
  }
}

/** Reads server-sent events: "text" carries the answer so far, then "done" or "error". */
async function readAssistantStream(
  stream: ReadableStream<Uint8Array>,
  onText: (soFar: string) => void,
): Promise<StreamOutcome> {
  let shown = false;
  try {
    for await (const e of sseEvents(stream)) {
      if (e.event === "done")
        return { kind: "done", answer: fromServer<AssistantAnswer>(JSON.parse(e.data)) };
      if (e.event === "error") return { kind: "failed", shown };
      if (e.event !== "text") continue;
      shown = true;
      const text = streamText(e.data);
      if (text !== undefined) onText(text);
    }
  } catch {
    // The connection dropped part-way.
  }
  return { kind: "failed", shown };
}

/**
 * The assistant's answer as it's written: `onText` gets the answer so far, word by word.
 * When streaming isn't available (an older server, a proxy that buffers), it asks the
 * ordinary way, so the answer always arrives.
 */
export async function streamAssistantAnswer(
  ev: PlannrEvent,
  thread: Message[],
  text: string,
  lang: string | undefined,
  onText: (soFar: string) => void,
): Promise<AssistantAnswer | undefined> {
  if (typeof window === "undefined" || !(await aiEnabled())) return undefined;
  const stream = await openAssistantStream(assistantBody(ev, thread, text, lang));
  if (!stream) return askAssistant(ev, thread, text, lang);
  const outcome = await readAssistantStream(stream, onText);
  if (outcome.kind === "done") return outcome.answer;
  // Once words are on screen, asking again would replace them mid-sentence.
  return outcome.shown ? undefined : askAssistant(ev, thread, text, lang);
}
