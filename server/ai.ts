import {
  type AiConfig,
  aiConfig,
  type Fetch,
  type GenerateArgs,
  generateOnce,
  type Meter,
  UpstreamError,
  withFallback,
} from "./gemini";
import { assistantPrompt, assistantRequest, assistantSchema, sanitizeAssistant } from "./prompts/assistant";
import {
  readPrompt,
  readRequest,
  readSchema,
  sanitizeRead,
  sanitizeWrite,
  writePrompt,
  writeRequest,
  writeSchema,
} from "./prompts/documents";
import { ideasPrompt, ideasRequest, ideasSchema, sanitizeIdeas } from "./prompts/ideas";
import { intakePrompt, intakeRequest, intakeSchema, sanitizeIntake } from "./prompts/intake";
import { BadRequest } from "./prompts/kit";
import { planPrompt, planRequest, planSchema, sanitizePlan } from "./prompts/plan";

export const TIMEOUT_MS = 25000;
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

/** One line per answered call, so the logs say what each route costs and how long it takes. */
export function logCall(
  config: AiConfig,
  route: string,
  model: string,
  tokens: number,
  started: number,
): void {
  config.log?.(
    `[ai] ${route} · ${model} · ${tokens} tokens · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

/** How long each route may take in all, inside what the browser waits for. */
export const BUDGET_MS: Record<string, number> = {
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

export function failure(route: string, e: unknown): AiResponse {
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
  const started = Date.now();
  const used = { model: config.model, meter: meter ?? { tokens: 0 } };
  try {
    const { args, finish } = spec(body);
    const raw = await withFallback(config, BUDGET_MS[route] ?? TIMEOUT_MS, (model, timeoutMs) => {
      used.model = model;
      return generateOnce(config, model, args, fetchImpl, timeoutMs, used.meter);
    });
    const answer = finish(raw);
    logCall(config, route, used.model, used.meter.tokens, started);
    return { status: 200, body: answer };
  } catch (e) {
    return failure(route, e);
  }
}

export { MAX_BODY };
