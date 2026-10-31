import type { Profile } from "../data/types";
import { list } from "../shared/records";
import { err, ok, type Result } from "../shared/result";
import { fromServer, problem } from "./api";
import { TODAY } from "./dates";
import { type IdeaSuggestion, ideaBrief, type PlannedEvent } from "./ideas";
import { shrinkImage } from "./images";
import type { PlanDraft } from "./plan";
import type { PlanNotes } from "./tailor";

/**
 * Gemini, through Plannr's own /api/ai routes. Every call here is optional: when the
 * server has no key, the network is down or the model is slow, the caller gets the reason
 * (or `undefined`) and falls back to the on-device logic, so the app never blocks on AI.
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

/**
 * How long the browser waits on each AI route: a little longer than the server gives Gemini
 * (BUDGET_MS in server/ai.ts), so the server's own timeout answers first, with a clear message.
 */
export const AI_TIMEOUT_MS: Record<"intake" | "plan" | "ideas" | "write" | "read", number> = {
  intake: 12_000,
  plan: 20_000,
  ideas: 20_000,
  write: 30_000,
  read: 45_000,
};

/** Why Gemini gave no answer, so a page can say so in plain words. */
export type AiFailure = "off" | "offline" | "timeout" | "busy" | "failed";

/** Calls one /api/ai route. Never throws: a failure comes back with its reason. */
export async function askAi<T>(
  route: string,
  body: unknown,
  timeoutMs: number,
): Promise<Result<T, AiFailure>> {
  if (typeof window === "undefined" || !(await aiEnabled())) return err("off");
  let res: Response;
  try {
    res = await fetch(`/api/ai/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return err(e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "offline");
  }
  if (res.status === 429) return err("busy");
  if (res.status === 503) return err("off");
  const answer: unknown = res.ok ? await res.json().catch(() => undefined) : undefined;
  return answer === undefined ? err("failed") : ok(fromServer<T>(answer));
}

/** The answer, or undefined: for callers that fall back to on-device logic whatever the reason. */
export async function post<T>(route: string, body: unknown, timeoutMs: number): Promise<T | undefined> {
  const answer = await askAi<T>(route, body, timeoutMs);
  return answer.ok ? answer.value : undefined;
}

/** What Plannr can write for the family. */
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
  const out = await post<{ text?: string }>("write", req, AI_TIMEOUT_MS.write);
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

/** Bytes turned into characters at a time, so a 3 MB file doesn't overflow the call stack. */
const BASE64_CHUNK = 0x8000;

/** A file's bytes as base64, the way the read route takes them. */
async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  return btoa(binary);
}

/**
 * Reads a bill, quote or contract: amounts, instalments, what's included and the terms.
 * Throws with a readable message, since the person is waiting on this one.
 */
export async function aiRead(
  file: File,
  context: { categories: string[]; guests?: number | undefined },
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
    signal: AbortSignal.timeout(AI_TIMEOUT_MS.read),
  }).catch(() => undefined);
  if (!res) throw new Error("Couldn't reach Plannr. Check the connection and try again.");
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(problem(body) ?? "Couldn't read that document.");
  return fromServer<ReadResult>(body);
}

// ---------------------------------------------------------------- plan draft

/** Gemini's budget split, dated tasks, vendors and notes for a draft, tailored from Plannr's standard one. */
export function planNotes(profile: Profile, plan: PlanDraft): Promise<Result<PlanNotes, AiFailure>> {
  return askAi<PlanNotes>("plan", { profile, plan, today: TODAY }, AI_TIMEOUT_MS.plan);
}

// ---------------------------------------------------------------- ideas

/** Ideas Gemini picks for this event, none already on the board. */
export async function suggestIdeas(ev: PlannedEvent): Promise<IdeaSuggestion[] | undefined> {
  const out = await post<{ ideas?: IdeaSuggestion[] }>(
    "ideas",
    { brief: ideaBrief(ev), avoid: list(ev, "ideas").map((i) => i.title), today: TODAY },
    AI_TIMEOUT_MS.ideas,
  );
  return out?.ideas?.length ? out.ideas : undefined;
}
