import type { Category, CommunityEvent, Idea, PersonalEvent } from "../data/types";
import { functionsOf, list } from "../shared/records";
import { monthName } from "./dates";
import { plural } from "./format";

/** One suggestion, from Gemini or from the rules below, before it goes on the ideas board. */
export interface IdeaSuggestion {
  title: string;
  detail: string;
  /** The detail of this event it answers. */
  because: string;
  effort: NonNullable<Idea["effort"]>;
  cost?: number;
  /** A budget line, by name. */
  category?: string;
}

export type PlannedEvent = PersonalEvent | CommunityEvent;

const MAX_DEVICE_IDEAS = 6;

/**
 * What the ideas route sees: the shape of the event and the family's own notes.
 * Guests appear as counts only, never a name, a number or a note about one household.
 */
export function ideaBrief(ev: PlannedEvent): Record<string, unknown> {
  const households = list(ev, "households");
  const meals = { veg: 0, nonveg: 0, jain: 0 };
  for (const h of households) if (h.meal) meals[h.meal] += h.expected;
  return {
    kind: ev.kind,
    event: ev.name,
    summary: ev.listMeta,
    date: ev.date,
    functions: functionsOf(ev).map((f) => ({ label: f.label, date: f.date, place: f.place, dress: f.dress })),
    guests: guestCount(ev),
    meals: households.some((h) => h.meal) ? meals : undefined,
    householdsWithCareNeeds: careNeeds(ev) || undefined,
    householdsStaying: households.filter((h) => h.stay).length || undefined,
    budget:
      ev.layout === "personal"
        ? {
            total: ev.budget.total,
            lines: ev.budget.categories.map((c) => ({ name: c.name, planned: c.planned })),
          }
        : { total: ev.funds.budget },
    segments: ev.layout === "community" ? ev.segments.map((s) => s.label) : undefined,
    notes: list(ev, "memory").map((m) => m.text),
  };
}

/** A suggestion as a record on the board, joined to its budget line when the name matches one. */
export function ideaRecord(s: IdeaSuggestion, categories: Category[], id: string): Idea {
  const line = s.category?.toLowerCase();
  const c = line ? categories.find((x) => x.name.toLowerCase() === line) : undefined;
  return {
    id,
    title: s.title,
    note: s.detail,
    because: s.because,
    effort: s.effort,
    status: "idea",
    ...(s.cost ? { cost: s.cost } : {}),
    ...(c ? { categoryId: c.id } : {}),
  };
}

// ---------------------------------------------------------------- on the device

const guestCount = (ev: PlannedEvent) => (ev.layout === "personal" ? ev.guests : ev.passes.capacity);
const careNeeds = (ev: PlannedEvent) => list(ev, "households").filter((h) => h.needs?.trim()).length;
const month = (ev: PlannedEvent) => Number(ev.date.slice(5, 7));

/** The budget line whose name matches, so a planned idea lands on the right one. */
function lineFor(ev: PlannedEvent, pattern: RegExp): string | undefined {
  return ev.layout === "personal" ? ev.budget.categories.find((c) => pattern.test(c.name))?.name : undefined;
}

type Rule = (ev: PlannedEvent) => IdeaSuggestion | undefined;

/** Each rule reads one detail of the event and says which, so even offline ideas explain themselves. */
const RULES: Rule[] = [
  (ev) =>
    month(ev) >= 3 && month(ev) <= 5
      ? {
          title: "Shade and cold drinks at arrival",
          detail: "Put up a shamiana where guests wait and serve tender coconut or sherbet as they arrive.",
          because: `${monthName(ev.date)} afternoons are hot`,
          effort: "low",
          category: lineFor(ev, /food|cater/i),
        }
      : undefined,
  (ev) =>
    month(ev) >= 6 && month(ev) <= 9
      ? {
          title: "A covered path from the cars",
          detail: "Ask the venue for a covered walkway, and keep umbrellas and floor mats at the entrance.",
          because: `${monthName(ev.date)} is in the monsoon`,
          effort: "low",
          category: lineFor(ev, /venue|d[ée]cor/i),
        }
      : undefined,
  (ev) =>
    guestCount(ev) > 200
      ? {
          title: "Two serving lines",
          detail: "Ask the caterer for a second counter so the queue halves at the busiest hour.",
          because: `${guestCount(ev)} guests at one counter means a long wait`,
          effort: "medium",
          category: lineFor(ev, /food|cater/i),
        }
      : undefined,
  (ev) => {
    const n = careNeeds(ev);
    return n
      ? {
          title: "A helper for guests with care needs",
          detail:
            "Name one person to meet them at the car, seat them close to the stage and check the route for steps.",
          because: `${plural(n, "household")} noted a need on their RSVP`,
          effort: "low",
        }
      : undefined;
  },
  (ev) => {
    const veg = list(ev, "households").reduce((s, h) => s + (h.meal === "veg" ? h.expected : 0), 0);
    return veg >= 20
      ? {
          title: "A vegetarian counter of its own",
          detail: "Serve vegetarian dishes at a separate, clearly labelled counter so nobody has to ask.",
          because: `${veg} guests chose vegetarian`,
          effort: "low",
          category: lineFor(ev, /food|cater/i),
        }
      : undefined;
  },
  (ev) => {
    const fns = functionsOf(ev);
    return fns.length >= 3
      ? {
          title: "One colour for each function",
          detail: "Pick a colour per function and tell the family early, so outfits and flowers follow it.",
          because: `${fns.length} functions, from the ${fns[0]?.label} to the ${fns.at(-1)?.label}`,
          effort: "low",
          category: lineFor(ev, /d[ée]cor/i),
        }
      : undefined;
  },
  (ev) => {
    const n = list(ev, "households").filter((h) => h.stay).length;
    return n >= 3
      ? {
          title: "A welcome note in every room",
          detail: "Leave water, a snack, the day's timings and a family contact for guests who travelled in.",
          because: `${plural(n, "household")} ${n === 1 ? "is" : "are"} staying over`,
          effort: "medium",
          category: lineFor(ev, /stay|room|accommodation/i),
        }
      : undefined;
  },
  (ev) => {
    const photos = lineFor(ev, /photo/i);
    return photos
      ? {
          title: "A shot list for the photographer",
          detail: "List the family groups and moments you can't miss, and send it a week before.",
          because: `${photos} is in the budget, so make every hour count`,
          effort: "low",
          category: photos,
        }
      : undefined;
  },
  (ev) =>
    ev.kind === "birthday"
      ? {
          title: "A craft to take home instead of favours",
          detail:
            "Let the children make something at the party, a painted pot or a badge, and carry it home.",
          because: "It is the party game and the return gift at once",
          effort: "medium",
          category: lineFor(ev, /gift|favour|return/i),
        }
      : undefined,
  (ev) =>
    ev.kind === "wedding"
      ? {
          title: "A blessings book at the entrance",
          detail:
            "Ask elders to write a line for the couple as they arrive; it becomes the keepsake of the day.",
          because: "A wedding gathers family who rarely meet",
          effort: "low",
        }
      : undefined,
  (ev) =>
    ev.layout === "community"
      ? {
          title: "Water and a lost-and-found at the gate",
          detail:
            "Set up one table at the entrance with drinking water, a first-aid kit and a lost-and-found.",
          because: `${ev.passes.capacity} passes come through one entrance`,
          effort: "low",
        }
      : undefined,
  () => ({
    title: "Pay vendors in stages",
    detail: "Agree an advance, a payment the week before and the balance after the event, in writing.",
    because: "Money stays in hand if plans change",
    effort: "low",
  }),
];

/** Ideas Plannr can offer with no network: the rules that match, minus what the board already has. */
export function deviceIdeas(ev: PlannedEvent): IdeaSuggestion[] {
  const board = new Set(list(ev, "ideas").map((i) => i.title.toLowerCase()));
  return RULES.map((rule) => rule(ev))
    .filter((s): s is IdeaSuggestion => !!s && !board.has(s.title.toLowerCase()))
    .slice(0, MAX_DEVICE_IDEAS);
}
