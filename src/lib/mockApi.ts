/**
 * Plannr's services (vendor directory, receipt reader) are simulated in this build.
 * They fail the way the real ones would: when the device is offline. Reviewers can
 * also force a failure with ?fail=vendors, ?fail=directory or ?fail=receipt.
 */
export type Service = "vendors" | "directory" | "receipt";

export function shouldFail(service: Service): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).getAll("fail").includes(service);
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Clears a forced failure so "Try again" can succeed. */
export function clearFailure(service: Service): void {
  const url = new URL(window.location.href);
  const rest = url.searchParams.getAll("fail").filter((f) => f !== service);
  url.searchParams.delete("fail");
  for (const f of rest) url.searchParams.append("fail", f);
  window.history.replaceState(window.history.state, "", url);
}
