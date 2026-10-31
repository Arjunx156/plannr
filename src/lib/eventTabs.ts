import type { PlannrEvent } from "../data/types";

export interface TabDef {
  id: string;
  label: string;
}

/** Every event opens on its overview and timeline. */
const FIRST: TabDef[] = [
  { id: "", label: "Overview" },
  { id: "timeline", label: "Timeline" },
];

/** What only community events have: the committee's money, its volunteers and its stalls. */
const COMMUNITY: TabDef[] = [
  { id: "funds", label: "Funds & permits" },
  { id: "volunteers", label: "Volunteers" },
  { id: "stalls", label: "Stalls & passes" },
];

/** What weddings and birthdays have instead: the guest list and the family's budget. */
const PERSONAL: TabDef[] = [
  { id: "guests", label: "Guests" },
  { id: "budget", label: "Budget" },
];

const LAST: TabDef[] = [
  { id: "vendors", label: "Vendors" },
  { id: "ideas", label: "Ideas" },
  { id: "day", label: "Day of" },
  { id: "website", label: "Website" },
  { id: "history", label: "History" },
  { id: "people", label: "People" },
  { id: "settings", label: "Settings" },
];

/**
 * The sections of one event, in order. Community events trade guests and budget for funds and volunteers.
 * "tasks" was the timeline's old address and still opens it.
 */
export function tabsFor(ev: PlannrEvent): TabDef[] {
  return [...FIRST, ...(ev.layout === "community" ? COMMUNITY : PERSONAL), ...LAST];
}
