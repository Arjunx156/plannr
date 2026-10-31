/**
 * What every Gemini route shares: the planner's voice, size limits, and the small checks that turn
 * untrusted JSON (from the browser or the model) into clean values. All pure, all tested.
 */
import { z } from "zod";
import { oneOf } from "../../src/shared/guards";

/** Size caps on what a request may send: its text, its context, and the conversation so far. */
export const LIMITS = { text: 4000, context: 60000, turns: 12, turnText: 2000 };

/** Whether a value is a JSON object, not an array or null. */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A string with its whitespace collapsed and its length capped, or undefined. */
export function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
}

/** Up to `max` non-empty strings from an array, each capped at `len` characters. */
function strList(v: unknown, max = 8, len = 80): string[] {
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

export { oneOf };

/** A real calendar date as YYYY-MM-DD, or undefined. */
function isoDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  return date.getUTCMonth() === (m ?? 0) - 1 && date.getUTCDate() === d ? v : undefined;
}

// ---------------------------------------------------------------- what the model answers
// Each prompt's answer is one zod schema with two jobs. Gemini is sent its JSON schema (geminiSchema), and
// the answer is cleaned by parsing it (parseAnswer). Every leaf runs one of the checks above before zod
// sees the value, so a value that doesn't clean reads as missing, and a missing required field drops the
// row it's in.

/** Text, its whitespace collapsed and capped at `max`. */
export const text = (max: number) => z.preprocess((v) => str(v, max), z.string());

/** Writing that keeps its line breaks: trimmed, capped at `max`, with no carriage returns. */
export const prose = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) || undefined : undefined),
    z.string(),
  );

/** A whole number from `lo` to `hi`, sent as a number or as digits with separators. */
export const whole = (lo: number, hi: number) => z.preprocess((v) => int(v, lo, hi), z.int());

/** A real calendar date, YYYY-MM-DD. */
export const calendarDay = () => z.preprocess(isoDate, z.string());

/** True when the model says so; anything else reads as missing. */
export const flag = () => z.preprocess((v) => (v === true ? true : undefined), z.boolean());

/** One of `options`, or `fallback` when the model strays and there is one. */
export const choice = <const T extends readonly [string, ...string[]]>(options: T, fallback?: T[number]) =>
  z.preprocess((v) => oneOf(v, options) ?? fallback, z.enum(options));

/** Up to `max` distinct texts, each capped at `len`. */
export const texts = (max: number, len: number) =>
  z.preprocess((v) => strList(v, max, len), z.array(z.string()));

/** Up to `max` distinct entries from `options`; the rest are dropped. */
export const choices = <const T extends readonly [string, ...string[]]>(options: T, max: number) =>
  z.preprocess((v) => strList(v, max).flatMap((s) => oneOf(s, options) ?? []), z.array(z.enum(options)));

/** The rows that clean, up to `max` of them; a row missing a required field is dropped, not the answer. */
export const rows = <T extends z.ZodType>(row: T, max?: number) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z
      .array(row.optional().catch(undefined))
      .transform((list) => list.filter((r): r is z.output<T> => r !== undefined).slice(0, max)),
  );

/** A field the model may leave out. A value that doesn't clean reads as left out, rather than failing its row. */
export const maybe = <T extends z.ZodType>(field: T) => field.optional().catch(undefined);

/** A JSON schema, as Gemini's `responseJsonSchema` takes it. */
export type JsonSchema = Record<string, unknown>;

/**
 * The JSON schema of what the model sends, before any cleaning. zod adds a few keys Gemini has no use for:
 * the dialect, the fallbacks from `.catch` and `.default`, and the safe-integer range on every `z.int()`.
 */
export function geminiSchema(answer: z.ZodType): JsonSchema {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(answer, {
    io: "input",
    override: ({ jsonSchema: node }) => {
      delete node.default;
      if (node.minimum === Number.MIN_SAFE_INTEGER) delete node.minimum;
      if (node.maximum === Number.MAX_SAFE_INTEGER) delete node.maximum;
    },
  });
  return schema;
}

/** The model's answer, cleaned by its schema; throws `failure` when a field the answer needs is missing. */
export function parseAnswer<T extends z.ZodType>(
  answer: T,
  raw: unknown,
  failure = "The answer was missing what it needs",
): z.output<T> {
  const parsed = answer.safeParse(isObject(raw) ? raw : {});
  if (!parsed.success) throw new Error(failure);
  return parsed.data;
}

// ---------------------------------------------------------------- what the browser sends

/** A request the client got wrong; answered with 400 and its message. */
export class BadRequest extends Error {}

/** A request body checked by its schema; throws BadRequest with the first problem found. */
export function parseRequest<T extends z.ZodType>(request: T, body: unknown): z.output<T> {
  const parsed = request.safeParse(body);
  if (!parsed.success) throw new BadRequest(parsed.error.issues[0]?.message ?? "Expected a JSON object");
  return parsed.data;
}

/** The request as a whole, which must be a JSON object; `error` is the answer when it isn't. */
export const requestBody = <T extends z.ZodRawShape>(shape: T, error = "Expected a JSON object") =>
  z.object(shape, { error });

/** Required text, trimmed and capped at `max`; a missing or blank one is refused, naming `field`. */
export const requiredText = (field: string, max = LIMITS.text) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined),
    z.string({ error: `${field} is required` }),
  );

/** A JSON object the request must carry; `error` is the answer when it doesn't. */
export const record = (error: string) => z.record(z.string(), z.unknown(), { error });

/** Data a prompt passes on as it came, or an empty object when there is none. */
export const passedOn = () => z.preprocess((v) => v ?? {}, z.unknown());

/** The date the browser says it is, or the server's own date when it doesn't say. */
export const requestDate = () => calendarDay().catch(() => new Date().toISOString().slice(0, 10));

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
