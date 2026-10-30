import {
  readPrompt,
  readRequest,
  readSchema,
  sanitizeRead,
  sanitizeWrite,
  writePrompt,
  writeRequest,
  writeSchema,
} from "./documentPrompts.js";
import { ideasPrompt, ideasRequest, ideasSchema, sanitizeIdeas } from "./ideaPrompts.js";
import { BadRequest } from "./promptKit.js";
import {
  assistantPrompt,
  assistantRequest,
  assistantSchema,
  intakePrompt,
  intakeRequest,
  intakeSchema,
  planPrompt,
  planRequest,
  planSchema,
  sanitizeAssistant,
  sanitizeIntake,
  sanitizePlan,
} from "./prompts.js";

/**
 * The one place that talks to Gemini. The key comes from the server's environment
 * (GEMINI_API_KEY) and never reaches the browser: the client posts to /api/ai/* and
 * this module builds the prompt, calls the model and sanitizes what comes back.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_MODEL = "gemini-3.5-flash";
const TIMEOUT_MS = 25000;
const MAX_BODY = 128 * 1024;
/** A document to read is sent whole: a 3 MB photo or PDF, base64. */
export const MAX_READ_BODY = 4_400_000;

/** What each route costs against a person's daily allowance. Reading a document is the heaviest. */
export const ROUTE_COST: Record<string, number> = {
  intake: 1,
  assistant: 1,
  plan: 2,
  ideas: 2,
  write: 1,
  read: 5,
};

/** Tried when the main model is busy or slow: a different model has its own capacity. */
export const FALLBACK_MODEL = "gemini-3.5-flash-lite";

export interface AiConfig {
  apiKey?: string;
  model: string;
  fallback?: string;
}

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    fallback: env.GEMINI_FALLBACK_MODEL?.trim() || FALLBACK_MODEL,
  };
}

/** How long each route may take in all, inside what the browser waits for. */
const BUDGET_MS: Record<string, number> = {
  intake: 11000,
  assistant: 19000,
  plan: 19000,
  ideas: 19000,
  write: 28000,
  read: 42000,
};

export interface AiResponse {
  status: number;
  body: unknown;
}

/** Tokens the model used for one request, for the daily allowance and the cost view. */
export interface Meter {
  tokens: number;
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GenerateArgs {
  system: string;
  contents: { role: "user" | "model"; parts: Part[] }[];
  schema: unknown;
  temperature?: number;
}

class UpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Busy, rate-limited, failing or slow: worth one more try on the other model. */
function retryable(e: unknown): boolean {
  if (e instanceof UpstreamError) return [429, 500, 502, 503, 504].includes(e.status);
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

/** An attempt with less time than this left isn't worth starting. */
const MIN_ATTEMPT_MS = 2500;
/** The main model gets just over half the time left, so the fallback still has a fair go. */
const MAIN_MODEL_SHARE = 0.55;
/** Characters of an upstream error body kept in the log. */
const ERROR_DETAIL_CHARS = 300;

/** The main model, then the fallback when one is configured and different. */
function modelsToTry(config: AiConfig): string[] {
  const { model, fallback } = config;
  return fallback && fallback !== model ? [model, fallback] : [model];
}

/**
 * Runs `attempt` on the main model, and when it's busy or slow on the fallback with the time
 * left, so a spike at Google doesn't leave a family staring at an error. `canRetry` decides
 * whether a failure is worth the second try.
 */
async function withFallback<T>(
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
async function postGemini(
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

function requestBody(args: GenerateArgs): string {
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

interface Chunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { totalTokenCount?: number };
}

function chunkText(data: Chunk): string {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

/** One non-streaming call: the model's JSON answer, parsed. */
async function generateOnce(
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
 * The answer text so far, read out of a JSON object that is still arriving:
 * `{"text": "The caterer's adv` → `The caterer's adv`. Only a leading "text" counts, so
 * a "text" inside a proposed change is never mistaken for the answer.
 */
export function partialText(raw: string): string | undefined {
  const start = raw.match(/^\s*\{\s*"text"\s*:\s*"/);
  if (!start) return undefined;
  const ESC: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" };
  let out = "";
  let i = start[0].length;
  while (i < raw.length) {
    const c = raw[i] as string;
    if (c === '"') break;
    if (c !== "\\") {
      out += c;
      i += 1;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    if (next === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 6;
      continue;
    }
    out += ESC[next] ?? next;
    i += 2;
  }
  return out;
}

/** Reads Gemini's server-sent events, handing each chunk's text to `onChunk`. */
async function readStream(res: Response, onChunk: (text: string) => void, meter?: Meter): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new UpstreamError("Gemini sent no stream", 502);
  const decoder = new TextDecoder();
  let buffer = "";
  const take = (line: string) => {
    if (!line.startsWith("data:")) return;
    const json = line.slice(5).trim();
    if (!json) return;
    const data = JSON.parse(json) as Chunk;
    if (meter && data.usageMetadata?.totalTokenCount) meter.tokens = data.usageMetadata.totalTokenCount;
    const text = chunkText(data);
    if (text) onChunk(text);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      take(buffer.slice(0, nl).replace(/\r$/, ""));
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) take(buffer.trim());
}

/**
 * The assistant's answer, streamed: `onText` gets the answer so far as it arrives, and the
 * finished, sanitized answer comes back at the end. A busy model is swapped for the fallback
 * as long as nothing has been shown yet.
 */
export async function streamAssistant(
  body: unknown,
  onText: (text: string) => void,
  config: AiConfig = aiConfig(),
  fetchImpl: Fetch = fetch,
  meter?: Meter,
): Promise<AiResponse> {
  if (!config.apiKey) return { status: 503, body: { error: "AI is not configured on this server" } };
  try {
    const { system, contents } = assistantPrompt(assistantRequest(body));
    const payload = requestBody({ system, contents, schema: assistantSchema });
    let shown = "";
    const answer = await withFallback(
      config,
      BUDGET_MS.assistant ?? TIMEOUT_MS,
      async (model, timeoutMs) => {
        const res = await postGemini(
          config,
          model,
          "streamGenerateContent?alt=sse",
          payload,
          timeoutMs,
          fetchImpl,
        );
        let raw = "";
        const onChunk = (chunk: string) => {
          raw += chunk;
          const text = partialText(raw);
          if (text && text.length > shown.length) {
            shown = text;
            onText(text);
          }
        };
        await readStream(res, onChunk, meter);
        if (!raw) throw new UpstreamError("Gemini returned no text", 502);
        return sanitizeAssistant(JSON.parse(raw));
      },
      // Once words are on screen, switching models would replace them mid-sentence.
      (e) => !shown && retryable(e),
    );
    return { status: 200, body: answer };
  } catch (e) {
    return failure("assistant", e);
  }
}

function failure(route: string, e: unknown): AiResponse {
  if (e instanceof BadRequest) return { status: 400, body: { error: e.message } };
  const status = e instanceof UpstreamError && e.status === 429 ? 429 : 502;
  console.error(`[ai] ${route} failed:`, e instanceof Error ? e.message : e);
  return {
    status,
    body: { error: status === 429 ? "AI is busy, try again shortly" : "AI request failed" },
  };
}

const user = (text: string) => [{ role: "user" as const, parts: [{ text }] }];

/** One AI route: checks the request, builds the prompt, and cleans what the model sends back. */
type RouteSpec = (body: unknown) => { args: GenerateArgs; finish: (raw: unknown) => unknown };

const ROUTES: Record<string, RouteSpec> = {
  intake: (body) => {
    const req = intakeRequest(body);
    const { system, user: text } = intakePrompt(req);
    return {
      args: { system, contents: user(text), schema: intakeSchema, temperature: 0.1 },
      finish: (raw) => sanitizeIntake(raw, req.today),
    };
  },
  assistant: (body) => {
    const { system, contents } = assistantPrompt(assistantRequest(body));
    return { args: { system, contents, schema: assistantSchema }, finish: sanitizeAssistant };
  },
  plan: (body) => {
    const { system, user: text } = planPrompt(planRequest(body));
    return {
      args: { system, contents: user(text), schema: planSchema, temperature: 0.6 },
      finish: sanitizePlan,
    };
  },
  ideas: (body) => {
    const req = ideasRequest(body);
    const { system, user: text } = ideasPrompt(req);
    return {
      args: { system, contents: user(text), schema: ideasSchema, temperature: 0.8 },
      finish: (raw) => sanitizeIdeas(raw, req.avoid),
    };
  },
  write: (body) => {
    const { system, user: text } = writePrompt(writeRequest(body));
    return {
      args: { system, contents: user(text), schema: writeSchema, temperature: 0.7 },
      finish: sanitizeWrite,
    };
  },
  read: (body) => {
    const req = readRequest(body);
    const { system, text } = readPrompt(req);
    return {
      args: {
        system,
        contents: [
          { role: "user", parts: [{ inlineData: { mimeType: req.mime, data: req.data } }, { text }] },
        ],
        schema: readSchema,
        temperature: 0,
      },
      finish: sanitizeRead,
    };
  },
};

/** Routes a request for /api/ai/<route>. Never throws; errors come back as JSON. */
export async function handleAi(
  route: string,
  body: unknown,
  config: AiConfig = aiConfig(),
  fetchImpl: Fetch = fetch,
  meter?: Meter,
): Promise<AiResponse> {
  if (route === "status") return { status: 200, body: { enabled: !!config.apiKey, model: config.model } };
  if (!config.apiKey) return { status: 503, body: { error: "AI is not configured on this server" } };
  const spec = Object.hasOwn(ROUTES, route) ? ROUTES[route] : undefined;
  if (!spec) return { status: 404, body: { error: "Unknown AI route" } };
  try {
    const { args, finish } = spec(body);
    const raw = await withFallback(config, BUDGET_MS[route] ?? TIMEOUT_MS, (model, timeoutMs) =>
      generateOnce(config, model, args, fetchImpl, timeoutMs, meter),
    );
    return { status: 200, body: finish(raw) };
  } catch (e) {
    return failure(route, e);
  }
}

/** A small fixed-window limiter so one client can't run up the bill. */
export function rateLimiter(limit = 40, windowMs = 60000) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string, now = Date.now()): boolean => {
    const h = hits.get(key);
    if (!h || h.reset <= now) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { count: 1, reset: now + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}

export { MAX_BODY };
