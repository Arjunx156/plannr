import { afterEach, describe, expect, test } from "bun:test";
import { GET, POST } from "../api/ai/[route].ts";

const saved = process.env.GEMINI_API_KEY;
afterEach(() => {
  process.env.GEMINI_API_KEY = saved;
});

const req = (path: string, init?: RequestInit) => new Request(`https://plannr.test/api/ai/${path}`, init);

describe("the Vercel function", () => {
  test("reports whether AI is on, without the key", async () => {
    process.env.GEMINI_API_KEY = "secret-key";
    const res = await GET(req("status"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(JSON.parse(text).enabled).toBe(true);
    expect(text).not.toContain("secret-key");
  });

  test("only answers status over GET", async () => {
    expect((await GET(req("intake"))).status).toBe(405);
  });

  test("refuses AI routes when the server has no key", async () => {
    process.env.GEMINI_API_KEY = "";
    const res = await POST(
      req("intake", { method: "POST", body: JSON.stringify({ text: "Wedding in Kochi" }) }),
    );
    expect(res.status).toBe(503);
  });

  test("rejects oversized bodies before reading them", async () => {
    process.env.GEMINI_API_KEY = "secret-key";
    const res = await POST(
      req("intake", { method: "POST", body: "{}", headers: { "content-length": String(1024 * 1024) } }),
    );
    expect(res.status).toBe(413);
  });
});
