/**
 * What every Gemini route shares: the planner's voice, size limits, and the small checks that turn
 * untrusted JSON (from the browser or the model) into clean values. All pure, all tested.
 */

export const LIMITS = { text: 4000, context: 60000, turns: 12, turnText: 2000 };

export type Json = Record<string, unknown>;

export function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
}

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

export function int(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "string" ? Number(v.replace(/[,_\s]/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r >= lo && r <= hi ? r : undefined;
}

export function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return date.getUTCMonth() === (m ?? 0) - 1 && date.getUTCDate() === d ? v : undefined;
}

export class BadRequest extends Error {}

export function requireText(v: unknown, field: string, max = LIMITS.text): string {
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} is required`);
  return v.trim().slice(0, max);
}

export function clip(v: unknown, max = LIMITS.context): string {
  const s = JSON.stringify(v ?? null);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const LANG_NAMES: Record<string, string> = {
  EN: "English",
  ML: "Malayalam",
  HI: "Hindi",
  TA: "Tamil",
  KN: "Kannada",
  TE: "Telugu",
};

export const VOICE = `You are Plannr, a calm, practical event planner for families and community groups in India.
Write in plain, warm sentences. No emoji, no markdown, no exclamation marks. Money is Indian rupees with lakh
grouping (₹1,80,000; ₹18 lakh). Never invent vendor names, prices or facts that are not given to you.`;
