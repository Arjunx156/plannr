export type Fetch = (input: string, init: RequestInit) => Promise<Response>;
export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
export interface GenerateArgs {
  system: string;
  contents: { role: "user" | "model"; parts: Part[] }[];
  schema: unknown;
  temperature?: number;
}
export class UpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Busy, rate-limited, failing or slow: worth one more try on the other model. */
export function retryable(e: unknown): boolean {
  if (e instanceof UpstreamError) return [429, 500, 502, 503, 504].includes(e.status);
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}
/** An attempt with less time than this left isn't worth starting. */
export const MIN_ATTEMPT_MS = 2500;
/** The main model gets just over half the time left, so the fallback still has a fair go. */
export const MAIN_MODEL_SHARE = 0.55;
/** Characters of an upstream error body kept in the log. */
export const ERROR_DETAIL_CHARS = 300;
/** The main model, then the fallback when one is configured and different. */
export function modelsToTry(config: AiConfig): string[] {
  const { model, fallback } = config;
  return fallback && fallback !== model ? [model, fallback] : [model];
}
/**
 * Runs `attempt` on the main model, and when it's busy or slow on the fallback with the time
 * left, so a spike at Google doesn't leave a family staring at an error. `canRetry` decides
 * whether a failure is worth the second try.
 */
export async function withFallback<T>(
  config: AiConfig,
  budgetMs: number,
  attempt: (model: string, timeoutMs: number) => Promise<T>,
  canRetry: (e: unknown) => boolean = retryable,
): Promise<T> {
  const deadline = Date.now() + budgetMs;
  const models = modelsToTry(config);
  let last: unknown = new UpstreamError("AI took too long", 504);
  for (const [i, model] of models.entries()) {
    const left = deadline - Date.now();
    if (left < MIN_ATTEMPT_MS) break;
    const isLast = i === models.length - 1;
    try {
      return await attempt(model, isLast ? left : Math.round(left * MAIN_MODEL_SHARE));
    } catch (e) {
      last = e;
      if (!canRetry(e)) throw e;
      console.warn(`[ai] ${model} unavailable, ${isLast ? "giving up" : "trying the fallback"}`);
    }
  }
  throw last;
}
/** Posts to one Gemini method; anything but a 2xx becomes an UpstreamError carrying its status. */
export async function postGemini(
  config: AiConfig,
  model: string,
  method: "generateContent" | "streamGenerateContent?alt=sse",
  body: string,
  timeoutMs: number,
  fetchImpl: Fetch,
): Promise<Response> {
  const res = await fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:${method}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey ?? "" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.ok) return res;
  const detail = await res.text().catch(() => "");
  throw new UpstreamError(`Gemini ${res.status}: ${detail.slice(0, ERROR_DETAIL_CHARS)}`, res.status);
}
export function requestBody(args: GenerateArgs): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: args.system }] },
    contents: args.contents,
    generationConfig: {
      // Plannr's answers come from the plan and its computed facts; long thinking only adds waiting.
      thinkingConfig: { thinkingLevel: "minimal" },
      responseMimeType: "application/json",
      responseJsonSchema: args.schema,
      temperature: args.temperature ?? 0.4,
    },
  });
}
export interface Chunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { totalTokenCount?: number };
}
export function chunkText(data: Chunk): string {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}
/** One non-streaming call: the model's JSON answer, parsed. */
export async function generateOnce(
  config: AiConfig,
  model: string,
  args: GenerateArgs,
  fetchImpl: Fetch,
  timeoutMs: number,
  meter?: Meter,
): Promise<unknown> {
  const res = await postGemini(config, model, "generateContent", requestBody(args), timeoutMs, fetchImpl);
  const data = (await res.json()) as Chunk;
  if (meter) meter.tokens += data.usageMetadata?.totalTokenCount ?? 0;
  const text = chunkText(data);
  if (!text) throw new UpstreamError("Gemini returned no text", 502);
  return JSON.parse(text);
}

/**
 * The one place that talks to Gemini. The key comes from the server's environment
 * (GEMINI_API_KEY) and never reaches the browser: the client posts to /api/ai/* and
 * this module builds the prompt, calls the model and sanitizes what comes back.
 */
export const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_MODEL = "gemini-3.5-flash";

/** Tried when the main model is busy or slow: a different model has its own capacity. */
export const FALLBACK_MODEL = "gemini-3.5-flash-lite";

export interface AiConfig {
  apiKey?: string;
  model: string;
  fallback?: string;
  /** Where the one line per call goes: route, model, tokens and time. Silent when absent. */
  log?: (line: string) => void;
}

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    fallback: env.GEMINI_FALLBACK_MODEL?.trim() || FALLBACK_MODEL,
    log: (line) => console.info(line),
  };
}

/** Tokens the model used for one request, for the daily allowance and the cost view. */
export interface Meter {
  tokens: number;
}
