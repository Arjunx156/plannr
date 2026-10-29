/**
 * Two small signals back to Plannr: one visit count per browser session (no cookie, no
 * identity), and crash reports so broken screens get fixed. At most five reports a session.
 */

let sent = 0;
const seen = new Set<string>();

function post(path: string, body: unknown): void {
  try {
    const data = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (!navigator.sendBeacon?.(path, data))
      void fetch(path, { method: "POST", body: data, keepalive: true }).catch(() => {});
  } catch {
    // Reporting is best-effort.
  }
}

export function reportError(error: unknown): void {
  if (!import.meta.env.PROD || sent >= 5) return;
  const e = error instanceof Error ? error : new Error(String(error));
  if (!e.message || seen.has(e.message)) return;
  seen.add(e.message);
  sent += 1;
  post("/api/errors", { message: e.message, stack: e.stack, url: location.pathname });
}

export function startReporting(): void {
  if (typeof window === "undefined" || !import.meta.env.PROD) return;
  try {
    if (!sessionStorage.getItem("plannr:visit")) {
      sessionStorage.setItem("plannr:visit", "1");
      post("/api/m", { name: "visit" });
    }
  } catch {
    // No session storage: skip the count.
  }
  window.addEventListener("error", (e) => reportError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason));
}
