/** The demo story's day, which the prompts are given as today. */
export const TODAY = "2026-09-27";

/** A server set up for Gemini, with a key that never reaches the network. */
export const config: { apiKey: string; model: string } = { apiKey: "test-key", model: "test-model" };

/** One request the server made to Gemini, as the stand-in saw it. */
export interface GeminiCall {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

/**
 * A stand-in for Gemini that answers every call with `payload` as its JSON text, or with an error
 * when `status` isn't 200, and records what it was sent.
 */
export function gemini(
  payload: unknown,
  status = 200,
): { calls: GeminiCall[]; fetchImpl: (url: string, init: RequestInit) => Promise<Response> } {
  const calls: GeminiCall[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)),
      headers: Object.fromEntries(new Headers(init.headers)),
    });
    const body =
      status === 200
        ? { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }
        : { error: { message: "nope" } };
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}
