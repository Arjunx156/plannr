import type { PlannrEvent } from "../../data/types";

export interface TabDef {
  id: string;
  label: string;
}

/**
 * The sections of one event, in order. Community events trade guests and budget for funds and volunteers.
 * "tasks" was the timeline's old address and still opens it.
 */
export function tabsFor(ev: PlannrEvent): TabDef[] {
  if (ev.layout === "community")
    return [
      { id: "", label: "Overview" },
      { id: "timeline", label: "Timeline" },
      { id: "funds", label: "Funds & permits" },
      { id: "volunteers", label: "Volunteers" },
      { id: "stalls", label: "Stalls & passes" },
      { id: "vendors", label: "Vendors" },
      { id: "ideas", label: "Ideas" },
      { id: "day", label: "Day of" },
      { id: "website", label: "Website" },
      { id: "history", label: "History" },
      { id: "people", label: "People" },
      { id: "settings", label: "Settings" },
    ];
  return [
    { id: "", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "guests", label: "Guests" },
    { id: "budget", label: "Budget" },
    { id: "vendors", label: "Vendors" },
    { id: "ideas", label: "Ideas" },
    { id: "day", label: "Day of" },
    { id: "website", label: "Website" },
    { id: "history", label: "History" },
    { id: "people", label: "People" },
    { id: "settings", label: "Settings" },
  ];
}
