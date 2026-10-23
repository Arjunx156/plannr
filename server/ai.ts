import {
  assistantPrompt,
  assistantRequest,
  assistantSchema,
  BadRequest,
  intakePrompt,
  intakeRequest,
  intakeSchema,
  planPrompt,
  planRequest,
  planSchema,
  sanitizeAssistant,
  sanitizeIntake,
  sanitizePlan,
} from "./prompts.ts";

/**
 * The one place that talks to Gemini. The key comes from the server's environment
 * (GEMINI_API_KEY) and never reaches the browser: the client posts to /api/ai/* and
 * this module builds the prompt, calls the model and sanitizes what comes back.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_MODEL = "gemini-flash-lite-latest";
const TIMEOUT_MS = 25000;
const MAX_BODY = 128 * 1024;

export interface AiConfig {
  apiKey?: string;
  model: string;
}

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export interface AiResponse {
  status: number;
  body: unknown;
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

interface GenerateArgs {
  system: string;
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
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

async function generate(config: AiConfig, args: GenerateArgs, fetchImpl: Fetch): Promise<unknown> {
  const res = await fetchImpl(`${BASE}/models/${encodeURIComponent(config.model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey ?? "" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: args.contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: args.schema,
        temperature: args.temperature ?? 0.4,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError(`Gemini ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) throw new UpstreamError("Gemini returned no text", 502);
  return JSON.parse(text);
}

const user = (text: string) => [{ role: "user" as const, parts: [{ text }] }];

/** Routes a request for /api/ai/<route>. Never throws; errors come back as JSON. */
export async function handleAi(
  route: string,
  body: unknown,
  config: AiConfig = aiConfig(),
  fetchImpl: Fetch = fetch,
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
      );
      return { status: 200, body: sanitizeIntake(raw, req.today) };
    }
    if (route === "assistant") {
      const req = assistantRequest(body);
      const { system, contents } = assistantPrompt(req);
      const raw = await generate(config, { system, contents, schema: assistantSchema }, fetchImpl);
      return { status: 200, body: sanitizeAssistant(raw) };
    }
    if (route === "plan") {
      const req = planRequest(body);
      const { system, user: text } = planPrompt(req);
      const raw = await generate(
        config,
        { system, contents: user(text), schema: planSchema, temperature: 0.6 },
        fetchImpl,
      );
      return { status: 200, body: sanitizePlan(raw) };
    }
    return { status: 404, body: { error: "Unknown AI route" } };
  } catch (e) {
    if (e instanceof BadRequest) return { status: 400, body: { error: e.message } };
    const status = e instanceof UpstreamError && e.status === 429 ? 429 : 502;
    console.error(`[ai] ${route} failed:`, e instanceof Error ? e.message : e);
    return {
      status,
      body: { error: status === 429 ? "AI is busy, try again shortly" : "AI request failed" },
    };
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
