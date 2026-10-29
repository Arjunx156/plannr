import type { PlannrEvent } from "../../data/types";

export interface TabDef {
  id: string;
  label: string;
}

/** The sections of one event, in order. Community events trade guests and budget for funds and volunteers. */
export function tabsFor(ev: PlannrEvent): TabDef[] {
  if (ev.layout === "community")
    return [
      { id: "", label: "Overview" },
      { id: "tasks", label: "Tasks" },
      { id: "funds", label: "Funds & permits" },
      { id: "volunteers", label: "Volunteers" },
      { id: "stalls", label: "Stalls & passes" },
      { id: "vendors", label: "Vendors" },
      { id: "day", label: "Day of" },
      { id: "website", label: "Website" },
      { id: "history", label: "History" },
      { id: "people", label: "People" },
      { id: "settings", label: "Settings" },
    ];
  return [
    { id: "", label: "Overview" },
    { id: "tasks", label: "Tasks" },
    { id: "guests", label: "Guests" },
    { id: "budget", label: "Budget" },
    { id: "vendors", label: "Vendors" },
    { id: "day", label: "Day of" },
    { id: "website", label: "Website" },
    { id: "history", label: "History" },
    { id: "people", label: "People" },
    { id: "settings", label: "Settings" },
  ];
}
