import { type AiResponse, BUDGET_MS, failure, logCall, TIMEOUT_MS } from "./ai";
import {
  type AiConfig,
  aiConfig,
  type Chunk,
  chunkText,
  type Fetch,
  type Meter,
  postGemini,
  requestBody,
  retryable,
  UpstreamError,
  withFallback,
} from "./gemini";
import { assistantPrompt, assistantRequest, assistantSchema, sanitizeAssistant } from "./prompts/assistant";

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
  const started = Date.now();
  const used = { model: config.model, meter: meter ?? { tokens: 0 } };
  try {
    const { system, contents } = assistantPrompt(assistantRequest(body));
    const payload = requestBody({ system, contents, schema: assistantSchema });
    let shown = "";
    const answer = await withFallback(
      config,
      BUDGET_MS.assistant ?? TIMEOUT_MS,
      async (model, timeoutMs) => {
        used.model = model;
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
        await readStream(res, onChunk, used.meter);
        if (!raw) throw new UpstreamError("Gemini returned no text", 502);
        return sanitizeAssistant(JSON.parse(raw));
      },
      // Once words are on screen, switching models would replace them mid-sentence.
      (e) => !shown && retryable(e),
    );
    logCall(config, "assistant stream", used.model, used.meter.tokens, started);
    return { status: 200, body: answer };
  } catch (e) {
    return failure("assistant", e);
  }
}
