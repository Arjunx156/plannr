const inrFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹18,00,000 — Indian lakh grouping. */
export function inr(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}₹${inrFormat.format(Math.abs(Math.round(amount)))}`;
}

/** +₹36,288 / −₹60,480, with a true minus sign. */
export function inrSigned(amount: number): string {
  if (amount === 0) return "₹0";
  return `${amount > 0 ? "+" : "−"}₹${inrFormat.format(Math.abs(Math.round(amount)))}`;
}

/** ₹6.85L, ₹18L, ₹2.5L for lakhs; full figures below one lakh. */
export function inrShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 100000) return inr(amount);
  const lakhs = abs / 100000;
  const text = lakhs >= 10 ? trim(lakhs.toFixed(1)) : trim(lakhs.toFixed(2));
  return `${amount < 0 ? "−" : ""}₹${text}L`;
}

function trim(n: string): string {
  return n.replace(/\.?0+$/, "");
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function clamp(n: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, n));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Ananya, Rohan" → "AR"; "Priya Menon" → "PM". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (first + last).toUpperCase();
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 48);
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a date. Real time, not the demo's. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "l"/"lakh" → 1,00,000; "cr"/"crore" → 1,00,00,000; "k"/"thousand" → 1,000; nothing → 1. */
function unitMultiplier(unit: string): number {
  if (unit.startsWith("l")) return 100_000;
  if (unit.startsWith("c")) return 10_000_000;
  return unit ? 1000 : 1;
}

/**
 * "2,40,000", "2.4L", "2.4 lakh", "85k" → rupees. Families write amounts every way; all of
 * them should work. Returns 0 for anything that isn't an amount.
 */
export function parseAmount(text: string): number {
  const t = text.toLowerCase().replace(/[₹,\s]|rs\.?|inr/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?)(l|lakh|lakhs|lac|k|thousand|cr|crore)?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2] ?? "";
  return Math.round(n * unitMultiplier(unit));
}
