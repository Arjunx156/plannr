import type { Profile } from "../data/types";
import { list } from "../shared/records";
import { TODAY } from "./dates";
import { type IdeaSuggestion, ideaBrief, type PlannedEvent } from "./ideas";
import { shrinkImage } from "./images";
import type { PlanDraft } from "./plan";
import type { PlanNotes } from "./tailor";

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

export async function post<T>(route: string, body: unknown, timeoutMs: number): Promise<T | undefined> {
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

// ---------------------------------------------------------------- plan draft

/** Gemini's budget split, dated tasks, vendors and notes for a draft, tailored from Plannr's standard one. */
export function planNotes(profile: Profile, plan: PlanDraft): Promise<PlanNotes | undefined> {
  return post<PlanNotes>("plan", { profile, plan, today: TODAY }, 20000);
}

// ---------------------------------------------------------------- ideas

/** Ideas Gemini picks for this event, none already on the board. */
export async function suggestIdeas(ev: PlannedEvent): Promise<IdeaSuggestion[] | undefined> {
  const out = await post<{ ideas?: IdeaSuggestion[] }>(
    "ideas",
    { brief: ideaBrief(ev), avoid: list(ev, "ideas").map((i) => i.title), today: TODAY },
    20000,
  );
  return out?.ideas?.length ? out.ideas : undefined;
}
