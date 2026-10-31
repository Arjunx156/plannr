/**
 * What every Gemini route shares: the planner's voice, size limits, and the small checks that turn
 * untrusted JSON (from the browser or the model) into clean values. All pure, all tested.
 */

export const LIMITS = { text: 4000, context: 60000, turns: 12, turnText: 2000 };

/** A JSON object from a request or a model, read field by field. */
export type Json = Record<string, unknown>;

/** Whether a value is a JSON object, not an array or null. */
export function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A string with its whitespace collapsed and its length capped, or undefined. */
export function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
}

/** Up to `max` non-empty strings from an array, each capped at `len` characters. */
export function strList(v: unknown, max = 8, len = 80): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = str(x, len);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** A whole number within bounds, from a number or digits with separators, or undefined. */
export function int(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "string" ? Number(v.replace(/[,_\s]/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : undefined;
}

export { oneOf } from "../../src/shared/guards";

/** A real calendar date as YYYY-MM-DD, or undefined. */
export function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return date.getUTCMonth() === (m ?? 0) - 1 && date.getUTCDate() === d ? v : undefined;
}

/** A request the client got wrong; answered with 400 and its message. */
export class BadRequest extends Error {}

/** A required, non-empty string, capped in length; throws BadRequest when it's missing. */
export function requireText(v: unknown, field: string, max = LIMITS.text): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} is required`);
  return v.trim().slice(0, max);
}

/** Any value as JSON for a prompt, cut at `max` characters. */
export function clip(v: unknown, max = LIMITS.context): string {
  const s = JSON.stringify(v ?? null);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Language codes as the prompts name them. */
export const LANG_NAMES: Record<string, string> = {
  EN: "English",
  ML: "Malayalam",
  HI: "Hindi",
  TA: "Tamil",
  KN: "Kannada",
  TE: "Telugu",
};

/** How Plannr sounds in every prompt: calm, practical and plain. */
export const VOICE = `You are Plannr, a calm, practical event planner for families and community groups in India.
Write in plain, warm sentences. No emoji, no markdown, no exclamation marks. Money is Indian rupees with lakh
grouping (₹1,80,000; ₹18 lakh). Never invent vendor names, prices or facts that are not given to you.`;
