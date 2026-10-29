import {
  assistantPrompt,
  assistantRequest,
  assistantSchema,
  BadRequest,
  ideasPrompt,
  ideasRequest,
  ideasSchema,
  intakePrompt,
  intakeRequest,
  intakeSchema,
  planPrompt,
  planRequest,
  planSchema,
  readPrompt,
  readRequest,
  readSchema,
  sanitizeAssistant,
  sanitizeIdeas,
  sanitizeIntake,
  sanitizePlan,
  sanitizeRead,
  sanitizeWrite,
  writePrompt,
  writeRequest,
  writeSchema,
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

/**
 * Asks the main model, and when it's busy or slow asks the fallback with the time left,
 * so a spike at Google doesn't leave a family staring at an error.
 */
async function generate(
  config: AiConfig,
  args: GenerateArgs,
  fetchImpl: Fetch,
  budgetMs = TIMEOUT_MS,
  meter?: Meter,
): Promise<unknown> {
  const deadline = Date.now() + budgetMs;
  const models = [
    config.model,
    ...(config.fallback && config.fallback !== config.model ? [config.fallback] : []),
  ];
  let last: unknown = new UpstreamError("AI took too long", 504);
  for (const [i, model] of models.entries()) {
    const left = deadline - Date.now();
    if (left < 2500) break;
    const share = i === models.length - 1 ? left : Math.round(left * 0.55);
    try {
      return await generateOnce(config, model, args, fetchImpl, share, meter);
    } catch (e) {
      last = e;
      if (!retryable(e)) throw e;
      console.warn(
        `[ai] ${model} unavailable, ${i < models.length - 1 ? "trying the fallback" : "giving up"}`,
      );
    }
  }
  throw last;
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

async function generateOnce(
  config: AiConfig,
  model: string,
  args: GenerateArgs,
  fetchImpl: Fetch,
  timeoutMs: number,
  meter?: Meter,
): Promise<unknown> {
  const res = await fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey ?? "" },
    body: requestBody(args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError(`Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
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
    const req = assistantRequest(body);
    const { system, contents } = assistantPrompt(req);
    const payload = requestBody({ system, contents, schema: assistantSchema });
    const deadline = Date.now() + (BUDGET_MS.assistant ?? TIMEOUT_MS);
    const models = [
      config.model,
      ...(config.fallback && config.fallback !== config.model ? [config.fallback] : []),
    ];
    let last: unknown = new UpstreamError("AI took too long", 504);
    for (const [i, model] of models.entries()) {
      const left = deadline - Date.now();
      if (left < 2500) break;
      let raw = "";
      let shown = "";
      try {
        const res = await fetchImpl(
          `${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey ?? "" },
            body: payload,
            signal: AbortSignal.timeout(i === models.length - 1 ? left : Math.round(left * 0.55)),
          },
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new UpstreamError(`Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status);
        }
        await readStream(
          res,
          (chunk) => {
            raw += chunk;
            const text = partialText(raw);
            if (text && text.length > shown.length) {
              shown = text;
              onText(text);
            }
          },
          meter,
        );
        if (!raw) throw new UpstreamError("Gemini returned no text", 502);
        return { status: 200, body: sanitizeAssistant(JSON.parse(raw)) };
      } catch (e) {
        last = e;
        // Once words are on screen, switching models would replace them mid-sentence.
        if (shown || !retryable(e)) throw e;
        console.warn(
          `[ai] ${model} unavailable, ${i < models.length - 1 ? "trying the fallback" : "giving up"}`,
        );
      }
    }
    throw last;
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
  try {
    if (route === "intake") {
      const req = intakeRequest(body);
      const { system, user: text } = intakePrompt(req);
      const raw = await generate(
        config,
        { system, contents: user(text), schema: intakeSchema, temperature: 0.1 },
        fetchImpl,
        BUDGET_MS.intake,
        meter,
      );
      return { status: 200, body: sanitizeIntake(raw, req.today) };
    }
    if (route === "assistant") {
      const req = assistantRequest(body);
      const { system, contents } = assistantPrompt(req);
      const raw = await generate(
        config,
        { system, contents, schema: assistantSchema },
        fetchImpl,
        BUDGET_MS.assistant,
        meter,
      );
      return { status: 200, body: sanitizeAssistant(raw) };
    }
    if (route === "plan") {
      const req = planRequest(body);
      const { system, user: text } = planPrompt(req);
      const raw = await generate(
        config,
        { system, contents: user(text), schema: planSchema, temperature: 0.6 },
        fetchImpl,
        BUDGET_MS.plan,
        meter,
      );
      return { status: 200, body: sanitizePlan(raw) };
    }
    if (route === "ideas") {
      const req = ideasRequest(body);
      const { system, user: text } = ideasPrompt(req);
      const raw = await generate(
        config,
        { system, contents: user(text), schema: ideasSchema, temperature: 0.8 },
        fetchImpl,
        BUDGET_MS.ideas,
        meter,
      );
      return { status: 200, body: sanitizeIdeas(raw, req.avoid) };
    }
    if (route === "write") {
      const req = writeRequest(body);
      const { system, user: text } = writePrompt(req);
      const raw = await generate(
        config,
        { system, contents: user(text), schema: writeSchema, temperature: 0.7 },
        fetchImpl,
        BUDGET_MS.write,
        meter,
      );
      return { status: 200, body: sanitizeWrite(raw) };
    }
    if (route === "read") {
      const req = readRequest(body);
      const { system, text } = readPrompt(req);
      const raw = await generate(
        config,
        {
          system,
          contents: [
            { role: "user", parts: [{ inlineData: { mimeType: req.mime, data: req.data } }, { text }] },
          ],
          schema: readSchema,
          temperature: 0,
        },
        fetchImpl,
        BUDGET_MS.read,
        meter,
      );
      return { status: 200, body: sanitizeRead(raw) };
    }
    return { status: 404, body: { error: "Unknown AI route" } };
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
