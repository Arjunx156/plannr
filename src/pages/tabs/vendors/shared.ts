import type { PlannrEvent, Vendor, VendorStage } from "../../../data/types";
import { longDate } from "../../../lib/dates";
import { functionsOf } from "../../../shared/records";

/** The vendor pipeline, in order. */
export const STAGES: VendorStage[] = ["needed", "enquired", "quoted", "booked"];
export const STAGE_TONE: Record<VendorStage, "idle" | "due" | "ok"> = {
  needed: "idle",
  enquired: "due",
  quoted: "due",
  booked: "ok",
};

export function guestsOf(ev: PlannrEvent): number {
  return ev.layout === "personal" ? ev.guests : 0;
}

export function enquiry(ev: PlannrEvent, v: Vendor): string {
  const fns = functionsOf(ev);
  const when =
    fns.length > 1
      ? `${fns.map((f) => f.label).join(", ")} (from ${longDate(fns[0]?.date ?? ev.date)})`
      : longDate(ev.date);
  const guests = guestsOf(ev);
  return `Namaste${v.contact ? ` ${v.contact}` : ""}, we're planning ${ev.name}: ${when}${guests ? `, about ${guests} guests` : ""}. Could you share your availability, packages and rates for ${v.category.toLowerCase()}? Thank you.`;
}
