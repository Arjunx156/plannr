import type { Kind } from "../data/baseTypes";
import type { Profile } from "../data/types";
import { addDays, parseDate } from "./dates";

export function vendorsFor(p: Profile): { list: string[]; note: string } {
  const city = p.city ?? "local";
  const month = p.date ? parseDate(p.date).toLocaleString("en-IN", { month: "long" }) : "the date";
  if (p.kind === "wedding") {
    const kerala = p.style === "Kerala-style";
    const ritual = kerala ? ["Vadhyar", "Chenda melam", "Nadaswaram"] : ["Priest", "Band or dhol", "DJ"];
    const list = [
      "Venue",
      kerala ? "Sadhya caterer" : "Caterer",
      "Decorator",
      "Photo & video",
      "Bridal makeup",
      ...ritual,
      ...(p.functions.includes("Mehendi") ? ["Mehendi artist"] : []),
      "Invitations",
      "Guest transport",
    ];
    return {
      list,
      note: `Photographer first: ${city} studios book about 6 months out for ${month}.`,
    };
  }
  if (p.kind === "birthday")
    return {
      list: ["Cake", "Entertainer", "Snacks caterer", "Return gifts", "Balloon décor"],
      note: "Order the cake 10 days out: shaped cakes need it.",
    };
  if (p.kind === "community")
    return {
      list: [
        "Sound & lighting",
        "Stall tents",
        "Security",
        "Sanitation",
        "Food stalls",
        "Pass printing",
        "Stage",
      ],
      note: "File police permission for amplified sound first: it takes about 3 weeks.",
    };
  return {
    list: ["Venue", "Caterer", "Decorator", "Photographer", "Invitations"],
    note: "Venue first: everything else keys off the date and the room.",
  };
}
/** The first month's tasks for each kind of event, by week from today. */
const FIRST_TASKS: Record<Kind, [string, number][]> = {
  wedding: [
    ["Confirm muhurtham with the family astrologer", 1],
    ["Visit the shortlisted venues", 1],
    ["Book the photographer", 2],
    ["Draft the guest list with both families", 3],
    ["Caterer tasting, two caterers", 4],
  ],
  birthday: [
    ["Book the entertainer", 1],
    ["Order the cake", 1],
    ["Send the invite", 1],
    ["Buy return gifts", 2],
    ["Décor and run sheet", 3],
  ],
  community: [
    ["File police permission for amplified sound", 1],
    ["Open stall sign-ups", 1],
    ["Confirm sponsors", 2],
    ["Build the volunteer shifts", 3],
    ["Fire safety check for stalls", 4],
  ],
  other: [
    ["Book the venue", 1],
    ["Write the guest list", 1],
    ["Send invitations", 2],
    ["Choose the caterer", 2],
    ["Share a run sheet", 4],
  ],
};
/** The milestones nearer the day, by days before it. */
const LATER_TASKS: Record<Kind, [string, number][]> = {
  wedding: [
    ["Print the invitations and book the makeup trial", 90],
    ["Give the caterer the final headcount", 30],
    ["Share the run sheet and pay the balances", 7],
  ],
  birthday: [
    ["Share the run sheet with the helpers", 3],
    ["Set up two hours before guests arrive", 0],
  ],
  community: [
    ["Print the passes and test the sound", 7],
    ["Walk the grounds for safety", 1],
  ],
  other: [["Confirm the final headcount", 7]],
};
/** The standard timeline: the first month's tasks, then the milestones nearer the day, in date order. */
export function timelineFor(kind: Kind, date: string, today: string): DraftTask[] {
  const first = FIRST_TASKS[kind].map(([title, week]) => {
    const due = addDays(today, week * 7);
    return { title, due: due < date ? due : addDays(date, -1) };
  });
  const later = LATER_TASKS[kind].map(([title, before]) => {
    const due = addDays(date, -before);
    return { title, due: due > today ? due : today };
  });
  return [...first, ...later].sort((a, b) => a.due.localeCompare(b.due));
}

/** One dated step on the way to the day. */
export interface DraftTask {
  title: string;
  due: string;
  why?: string;
}

export interface DraftVendor {
  name: string;
  why?: string;
}
