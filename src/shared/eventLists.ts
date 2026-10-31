import type { FunctionDay } from "../data/baseTypes";
import type { PersonalEvent, PlannrEvent } from "../data/types";
import type { Vendor, VendorStage } from "../data/vendorTypes";

export function slugId(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .slice(0, 40) || "item"
  );
}
const DAY_LABEL: Record<PlannrEvent["kind"], string> = {
  wedding: "The wedding",
  birthday: "The party",
  community: "The day",
  other: "The day",
};

/** The event's functions; an event without any is one day. */
export function functionsOf(ev: PlannrEvent): FunctionDay[] {
  if (ev.layout === "empty") return [];
  if (ev.functions?.length) return ev.functions;
  const time = ev.countdown.line.match(/\d{1,2}(?::\d{2})?\s?[ap]m/i)?.[0];
  return [{ id: "day", label: DAY_LABEL[ev.kind], date: ev.date, ...(time ? { time } : {}) }];
}
const LEGACY_STAGE: [keyof PersonalEvent["vendors"], VendorStage][] = [
  ["booked", "booked"],
  ["talking", "quoted"],
  ["needed", "needed"],
];

/** Vendors as records; plans made before vendor records list them by category only. */
export function vendorsOf(ev: PlannrEvent): Vendor[] {
  if (ev.layout === "empty") return [];
  if (ev.vendorList) return ev.vendorList;
  if (ev.layout !== "personal") return [];
  const out: Vendor[] = [];
  for (const [key, stage] of LEGACY_STAGE) {
    const names = ev.vendors[key];
    if (!Array.isArray(names)) continue;
    for (const category of names) out.push({ id: slugId(category), category, name: "", stage, quotes: [] });
  }
  return out;
}
