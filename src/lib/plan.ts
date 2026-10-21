import type { Kind, Profile } from "../data/types";
import { addDays, monthShort, parseDate, TODAY } from "./dates";

export interface BudgetLine {
  name: string;
  amount: number;
  color: string;
}

export interface PlanDraft {
  title: string;
  kind: Kind;
  basis: string;
  budget: { total: number; lines: BudgetLine[] };
  timeline: { when: string; what: string }[];
  tasks: number;
  vendors: string[];
  vendorNote: string;
  vendorFocus: string[];
  guests: { total: number; groups: { name: string; count: number }[]; note?: string };
  ideas: string;
}

const SPLITS: Record<Kind, [string, number][]> = {
  wedding: [
    ["Catering", 0.25],
    ["Venue", 0.1778],
    ["Décor", 0.1333],
    ["Attire & jewellery", 0.1222],
    ["Photography & video", 0.1],
    ["Transport & stay", 0.0528],
    ["Entertainment", 0.05],
    ["Gifts & favours", 0.0389],
    ["Invitations", 0.025],
    ["Contingency", 0.05],
  ],
  birthday: [
    ["Food & snacks", 0.25],
    ["Décor", 0.225],
    ["Entertainer", 0.2],
    ["Cake", 0.1125],
    ["Return gifts", 0.1125],
    ["Contingency", 0.1],
  ],
  community: [
    ["Stalls & setup", 0.24],
    ["Sound & lighting", 0.2],
    ["Cultural night", 0.14],
    ["Lights & décor", 0.12],
    ["Security & sanitation", 0.1],
    ["Prizes & gifts", 0.06],
    ["Publicity & passes", 0.04],
    ["Permits & fees", 0.03],
    ["Contingency", 0.07],
  ],
  other: [
    ["Food", 0.3],
    ["Venue", 0.2],
    ["Décor", 0.15],
    ["Photos", 0.1],
    ["Entertainment", 0.08],
    ["Gifts", 0.07],
    ["Invitations", 0.03],
    ["Contingency", 0.07],
  ],
};

export const SPLIT_COLORS = ["#6E1F2E", "#D9962B", "#3D7A4F", "#1F5F6B", "#B5452B"];
const REST_COLOR = "#CFC5B4";

function roundTo(total: number): number {
  if (total >= 500000) return 5000;
  if (total >= 100000) return 1000;
  return 500;
}

/** Split a budget by category for the event type. Lines always add up to the total. */
export function splitBudget(kind: Kind, total: number): BudgetLine[] {
  const step = roundTo(total);
  const split = SPLITS[kind];
  const lines = split.map(([name, share], i) => ({
    name,
    amount: Math.round((total * share) / step) * step,
    color: SPLIT_COLORS[i] ?? REST_COLOR,
  }));
  const drift = total - lines.reduce((s, l) => s + l.amount, 0);
  const last = lines[lines.length - 1];
  if (last) last.amount += drift;
  return lines;
}

export function countTasks(kind: Kind, functions: number, guests: number): number {
  if (kind === "wedding") return 45 + 6 * Math.max(1, functions) + (guests > 200 ? 2 : 0);
  if (kind === "birthday") return 18;
  if (kind === "community") return 30 + Math.min(24, Math.round(guests / 25));
  return 24;
}

function vendorsFor(p: Profile): { list: string[]; focus: string[]; note: string } {
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
      focus: ritual.map((r) => r.toLowerCase()),
      note: `Photographer first: ${city} studios book about 6 months out for ${month}.`,
    };
  }
  if (p.kind === "birthday")
    return {
      list: ["Cake", "Entertainer", "Snacks caterer", "Return gifts", "Balloon décor"],
      focus: ["the entertainer", "the cake", "return gifts"],
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
      focus: ["sound and lighting", "security", "sanitation"],
      note: "File police permission for amplified sound first: it takes about 3 weeks.",
    };
  return {
    list: ["Venue", "Caterer", "Decorator", "Photographer", "Invitations"],
    focus: ["the venue", "a caterer", "a photographer"],
    note: "Venue first: everything else keys off the date and the room.",
  };
}

function guestGroups(p: Profile, total: number): PlanDraft["guests"] {
  const share = (parts: [string, number][]) => {
    const groups = parts.map(([name, s]) => ({ name, count: Math.round(total * s) }));
    const drift = total - groups.reduce((a, g) => a + g.count, 0);
    const first = groups[0];
    if (first) first.count += drift;
    return groups;
  };
  const wheel = p.needs.find((n) => /wheelchair/i.test(n));
  const wheelCount = wheel?.match(/\d+/)?.[0] ?? "";
  const note = wheel
    ? `Step-free entry and ${wheelCount ? `${wheelCount} ` : ""}wheelchair spaces added to venue questions.`
    : p.needs.find((n) => /allerg/i.test(n))
      ? `Allergy notes collected on the RSVP form: ${p.needs.find((n) => /allerg/i.test(n))}.`
      : undefined;
  if (p.kind === "wedding")
    return {
      total,
      note,
      groups: share([
        ["Bride's side", 0.44],
        ["Groom's side", 0.4],
        ["Friends", 0.12],
        ["Colleagues", 0.04],
      ]),
    };
  if (p.kind === "birthday")
    return {
      total,
      note,
      groups: share([
        ["Kids", 0.6],
        ["Parents & family", 0.4],
      ]),
    };
  if (p.kind === "community")
    return {
      total,
      note,
      groups: share([
        ["Residents", 0.8],
        ["Visitors", 0.2],
      ]),
    };
  return {
    total,
    note,
    groups: share([
      ["Family", 0.6],
      ["Friends", 0.4],
    ]),
  };
}

function timelineFor(kind: Kind, date: string): PlanDraft["timeline"] {
  const mon = (iso: string) => monthShort(iso).toUpperCase();
  if (kind === "wedding")
    return [
      { when: `NOW–${mon(addDays(TODAY, 30))}`, what: "Venue, photographer, caterer tasting" },
      { when: mon(addDays(date, -90)), what: "Invitations printed, makeup trial" },
      { when: mon(addDays(date, -30)), what: "Final headcount to caterer" },
      { when: "WEEK OF", what: "Run sheet shared, balances paid" },
    ];
  if (kind === "birthday")
    return [
      { when: "THIS WEEK", what: "Theme, guest list, entertainer" },
      { when: "2 WEEKS OUT", what: "Cake ordered, return gifts bought" },
      { when: "WEEK OF", what: "Décor, snacks, run sheet" },
      { when: "ON THE DAY", what: "Set up two hours before guests arrive" },
    ];
  if (kind === "community")
    return [
      { when: `NOW–${mon(addDays(TODAY, 21))}`, what: "Committee roles, sponsors, permits filed" },
      { when: mon(addDays(date, -14)), what: "Stall sign-ups, volunteer shifts" },
      { when: "WEEK OF", what: "Passes, sound check, safety walk" },
      { when: "ON THE DAY", what: "Gates, stalls, the evening programme" },
    ];
  return [
    { when: "NOW", what: "Venue and guest list" },
    { when: mon(addDays(date, -30)), what: "Invitations out, menu chosen" },
    { when: "WEEK OF", what: "Final headcount, run sheet" },
    { when: "ON THE DAY", what: "Set up and enjoy it" },
  ];
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

export function planTitle(p: Profile): string {
  if (p.kind === "wedding") return p.names ?? "your wedding";
  if (p.kind === "birthday") return p.names ? `${p.names}'s birthday` : "the birthday";
  if (p.kind === "community") return "your community event";
  return "your event";
}

/** Everything the plan summary shows, derived from the profile alone. */
export function draftPlan(p: Profile): PlanDraft {
  const kind = p.kind ?? "other";
  const total = p.budget ?? 100000;
  const guests = p.guests ?? 50;
  const date = p.date ?? addDays(TODAY, 90);
  const vendors = vendorsFor({ ...p, kind });
  const fnCount = p.functions.length;
  const basisBits = [
    `${guests} guests${p.city ? ` in ${p.city}` : ""}`,
    kind === "wedding" && fnCount > 1 ? `${NUMBER_WORDS[fnCount] ?? fnCount} functions` : undefined,
    parseDate(date).toLocaleString("en-IN", { month: "long" }),
  ].filter(Boolean);
  const priorities = p.priorities.map((x) => x.toLowerCase()).join(" · ");
  const colours = p.colours.length
    ? p.colours.map((c) => c.toLowerCase()).join(" and ")
    : kind === "wedding" && p.style === "Kerala-style"
      ? "kasavu gold and ivory"
      : kind === "birthday"
        ? "the party theme"
        : "festive marigold and green";
  return {
    title: planTitle(p),
    kind,
    basis: `Based on ${basisBits.join(", ")}${priorities ? `, and ${priorities} as priorities` : ""}.`,
    budget: { total, lines: splitBudget(kind, total) },
    timeline: timelineFor(kind, date),
    tasks: countTasks(kind, fnCount, guests),
    vendors: vendors.list,
    vendorNote: vendors.note,
    vendorFocus: vendors.focus,
    guests: guestGroups({ ...p, kind }, guests),
    ideas: `Ideas in ${colours}`,
  };
}
