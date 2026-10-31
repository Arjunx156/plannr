/** The security headers and content security policy, as production sends them, and how API errors read. */
import { describe, expect, test } from "bun:test";
import { outputConfig } from "../scripts/vercelOutput";
import { createApp } from "../server/app";
import { createLocalDb } from "../server/db/local";
import { CSP, CSP_HEADER, PERMISSIONS_POLICY, SECURITY_HEADERS, withCspMeta } from "../server/security";
import { OWN_DB_MS } from "./server/fixtures";

/** The policy as directive → sources. */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split("; ").map((d) => {
      const [name = "", ...sources] = d.split(" ");
      return [name, sources];
    }),
  );
}

const csp = directives(CSP_HEADER);

describe("content security policy", () => {
  test("allows nothing unsafely: no inline script or style, no eval", () => {
    expect(CSP_HEADER).not.toContain("'unsafe-");
    expect(CSP_HEADER).not.toContain("'wasm-unsafe-eval'");
  });

  test("runs scripts and styles from Plannr itself only", () => {
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("script-src")).toEqual(["'self'"]);
    expect(csp.get("style-src")).toEqual(["'self'"]);
  });

  test("sends every script URL through Plannr's one Trusted Types policy", () => {
    expect(csp.get("require-trusted-types-for")).toEqual(["'script'"]);
    expect(csp.get("trusted-types")).toEqual(["plannr"]);
  });

  test("refuses plugins, foreign base URLs, framing and forms that post elsewhere", () => {
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.has("upgrade-insecure-requests")).toBe(true);
  });

  test("names every outside host; no source is a bare wildcard or a whole scheme", () => {
    for (const [name, sources] of csp) {
      for (const source of sources) {
        expect(source, `${name} ${source}`).not.toBe("*");
        expect(["http:", "https:"], `${name} ${source}`).not.toContain(source);
      }
    }
    // data: and blob: are only for images, fonts and media the page made itself.
    for (const name of ["script-src", "style-src", "connect-src", "default-src"])
      expect(csp.get(name)?.some((s) => s === "data:" || s === "blob:")).toBe(false);
  });

  test("built pages carry the same policy as a meta tag", () => {
    const page = withCspMeta('<head><meta charset="UTF-8" /></head>');
    expect(page).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    expect(CSP_HEADER.startsWith(CSP)).toBe(true);
  });
});

describe("headers on every response", () => {
  test("are routed before anything answers, so pages, the API, assets and errors all carry them", () => {
    const routes = outputConfig().routes;
    const security = routes.findIndex((r) => "headers" in r && r.src === "/(.*)");
    const firstAnswer = routes.findIndex((r) => "dest" in r || "handle" in r);
    expect(security).toBeGreaterThanOrEqual(0);
    expect(security).toBeLessThan(firstAnswer);
    expect(routes[security]).toEqual({ src: "/(.*)", headers: { ...SECURITY_HEADERS }, continue: true });
  });

  test("keep the page out of frames and other sites' windows, and its files to itself", () => {
    expect(SECURITY_HEADERS).toMatchObject({
      "content-security-policy": CSP_HEADER,
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "strict-origin-when-cross-origin",
    });
  });

  test("insist on HTTPS for two years, subdomains included", () => {
    const hsts = SECURITY_HEADERS["strict-transport-security"] ?? "";
    expect(Number(/max-age=(\d+)/.exec(hsts)?.[1])).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  test("switch off every browser feature but the camera and microphone, which stay on Plannr's own pages", () => {
    const features = new Map(
      PERMISSIONS_POLICY.split(", ").map((f) => {
        const [name = "", allow = ""] = f.split("=");
        return [name, allow];
      }),
    );
    expect(features.get("camera")).toBe("(self)");
    expect(features.get("microphone")).toBe("(self)");
    const on = [...features].filter(([, allow]) => allow !== "()").map(([name]) => name);
    expect(on.sort()).toEqual(["camera", "microphone"]);
    expect(features.get("geolocation")).toBe("()");
    expect(features.get("payment")).toBe("()");
  });
});

describe("API errors", () => {
  test(
    "an unexpected failure answers in plain words, with no stack trace or internals",
    async () => {
      const real = await createLocalDb();
      const Queries = new Set(["select", "insert", "update", "delete", "transaction", "execute"]);
      // Every query fails the way a lost connection would, with internals in the message.
      const broken = new Proxy(real, {
        get(target, prop, receiver) {
          if (Queries.has(String(prop))) throw new Error("connect ECONNREFUSED 10.0.0.5:5432 at pool.ts:42");
          return Reflect.get(target, prop, receiver);
        },
      });
      const app = createApp({ db: broken, env: {} });
      const res = await app.request("/api/p/some-token");
      const text = await res.text();
      expect(res.status).toBe(500);
      expect(JSON.parse(text)).toEqual({ error: "Something went wrong on our side" });
      expect(text).not.toContain("ECONNREFUSED");
      expect(text).not.toContain("pool.ts");
    },
    OWN_DB_MS,
  );
});
