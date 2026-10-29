import type { AiProposal, Message, PlannrEvent, Profile } from "../data/types";
import { fundTotals, rsvpSummary } from "../shared/derive";
import { TODAY } from "./dates";
import { shrinkImage } from "./images";
import { FUNCTION_ORDER } from "./intake";
import { budgetTotals, communityReadiness, personalReadiness, settle } from "./metrics";
import type { PlanDraft } from "./plan";

/**
 * Gemini, through Plannr's own /api/ai routes. Every call here is optional: when the
 * server has no key, the network is down or the model is slow, the caller gets
 * `undefined` and falls back to the on-device logic, so the app never blocks on AI.
 */

let status: Promise<boolean> | undefined;

/** Whether the server has a Gemini key. Asked once per page load. */
export function aiEnabled(): Promise<boolean> {
  status ??= fetch("/api/ai/status")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((s: { enabled?: boolean }) => !!s.enabled)
    .catch(() => false);
  return status;
}

async function post<T>(route: string, body: unknown, timeoutMs: number): Promise<T | undefined> {
  if (typeof window === "undefined" || !(await aiEnabled())) return undefined;
  try {
    const res = await fetch(`/api/ai/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- intake

export type AiIntake = Partial<Omit<Profile, "inspiration" | "priorities" | "cuts">> & { reply?: string };

export type WriteTask =
  | "translate"
  | "enquiry"
  | "thanks"
  | "permit"
  | "reminder"
  | "announcement"
  | "invite";

/** Plannr writes something for the family: a translation, a vendor enquiry, a thank-you note. */
export async function aiWrite(req: {
  task: WriteTask;
  lang?: string;
  text?: string;
  context?: Record<string, unknown>;
}): Promise<string | undefined> {
  const out = await post<{ text?: string }>("write", req, 30000);
  return out?.text?.trim() || undefined;
}

/** What Plannr read from a photo or PDF of a bill, quote or contract. */
export interface ReadResult {
  kind: "bill" | "quote" | "contract" | "other";
  vendor?: string;
  category?: string;
  total?: number;
  /** The amount is per plate or per guest. */
  perGuest?: boolean;
  date?: string;
  items: { label: string; amount: number }[];
  /** Instalments the document sets out: an advance, a balance. */
  payments: { label: string; amount: number; date?: string }[];
  inclusions?: string;
  terms?: string;
  summary?: string;
}

const MAX_READ_BYTES = 3 * 1024 * 1024;

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Reads a bill, quote or contract: amounts, instalments, what's included and the terms.
 * Throws with a readable message, since the person is waiting on this one.
 */
export async function aiRead(
  file: File,
  context: { categories: string[]; guests?: number },
): Promise<ReadResult> {
  if (!(await aiEnabled())) throw new Error("Reading documents needs AI, which isn't switched on here.");
  const blob = await shrinkImage(file);
  if (blob.size > MAX_READ_BYTES) throw new Error("That file is over 3 MB. Try a photo of the page instead.");
  const mime = blob.type || file.type;
  if (!/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(mime))
    throw new Error("Plannr can read photos (JPG, PNG, WebP) and PDFs.");
  const res = await fetch("/api/ai/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mime, data: await base64(blob), today: TODAY, ...context }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => undefined);
  if (!res) throw new Error("Couldn't reach Plannr. Check the connection and try again.");
  const body = (await res.json().catch(() => ({}))) as ReadResult & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Couldn't read that document.");
  return body;
}

export function extractWithAi(
  text: string,
  profile: Profile,
  asking?: string,
): Promise<AiIntake | undefined> {
  return post<AiIntake>("intake", { text, profile, asking, today: TODAY }, 12000);
}

function union(a: string[], b: string[] | undefined): string[] {
  const out = [...a];
  for (const x of b ?? []) if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  return out;
}

const words = (s: string) => s.toLowerCase().match(/[a-z]{4,}/g) ?? [];

/** "Grandmother uses a wheelchair" is already covered by "Wheelchair access". */
function covered(existing: string[], need: string): boolean {
  const mine = new Set(existing.flatMap(words));
  return words(need).some((w) => mine.has(w));
}

/**
 * Fills what the on-device parser missed with what Gemini read. The parser wins where
 * both found something: it is exact on the patterns it knows, and the model covers the
 * long tail of phrasings it doesn't.
 */
export function mergeAiProfile(local: Profile, ai: AiIntake | undefined): Profile {
  if (!ai) return local;
  const kind = local.kind ?? ai.kind;
  const date = local.date
    ? { date: local.date, dateText: local.dateText }
    : { date: ai.date, dateText: ai.dateText };
  const fns = new Set(union(local.functions, ai.functions));
  if (kind === "wedding") fns.add("Ceremony");
  return {
    ...local,
    kind,
    style: local.style ?? ai.style,
    names: local.names ?? ai.names,
    city: local.city ?? ai.city,
    date: date.date,
    dateText: date.date ? (date.dateText ?? date.date) : undefined,
    guests: local.guests ?? ai.guests,
    budget: local.budget ?? ai.budget,
    venueStatus: local.venueStatus ?? ai.venueStatus,
    venues: local.venues ?? ai.venues,
    functions: FUNCTION_ORDER.filter((f) => fns.has(f)),
    traditions: local.traditions ?? ai.traditions,
    needs: union(
      local.needs,
      ai.needs?.filter((n) => !covered(local.needs, n)),
    ),
    moods: union(local.moods, ai.moods),
    colours: union(local.colours, ai.colours),
    coPlanners: union(local.coPlanners, ai.coPlanners),
  };
}

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

export interface AssistantAnswer {
  text: string;
  source?: string;
  translation?: string;
  /** Changes it proposes; nothing applies until the planner approves the preview. */
  actions?: AiProposal[];
}

export function askAssistant(
  ev: PlannrEvent,
  thread: Message[],
  text: string,
  lang?: string,
): Promise<AssistantAnswer | undefined> {
  return post<AssistantAnswer>(
    "assistant",
    {
      text,
      lang,
      today: TODAY,
      event: compactEvent(ev),
      facts: eventFacts(ev),
      history: thread.slice(-12).map((m) => ({ role: m.role, text: m.text })),
    },
    20000,
  );
}

// ---------------------------------------------------------------- plan notes

export interface PlanNotes {
  summary: string;
  tips: { title: string; detail: string }[];
  watchouts: string[];
  ideas: string[];
}

export function planNotes(profile: Profile, plan: PlanDraft): Promise<PlanNotes | undefined> {
  return post<PlanNotes>("plan", { profile, plan, today: TODAY }, 20000);
}
