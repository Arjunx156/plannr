import type { FunctionDay, Hue, Kind, PersonalEvent, Profile, Task } from "../data/types";
import { addDays, longDate, shortDate, TODAY } from "./dates";
import { slug } from "./format";
import { KIND_LABEL } from "./intake";
import type { PlanDraft } from "./plan";

const HUE: Record<Kind, Hue> = {
  wedding: "marigold",
  birthday: "indigo",
  community: "leaf",
  other: "maroon",
};

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

const FUNCTION_OFFSET: Record<string, number> = {
  Engagement: -30,
  Mehendi: -3,
  Sangeet: -2,
  Haldi: -1,
  Ceremony: 0,
  Reception: 0,
};

export function eventName(p: Profile): string {
  if (p.kind === "wedding") return p.names ? `${p.names}'s wedding` : "Our wedding";
  if (p.kind === "birthday") return p.names ? `${p.names}'s birthday` : "Birthday party";
  if (p.kind === "community") return p.city ? `Community event, ${p.city}` : "Community event";
  return p.names ?? "New event";
}

/** The accepted draft becomes a live event with an empty ledger and its first tasks. */
export function eventFromDraft(
  p: Profile,
  plan: PlanDraft,
  user: { name: string; initials: string },
  existing?: { id: string; name: string },
): PersonalEvent {
  const kind = p.kind ?? "other";
  const date = p.date ?? addDays(TODAY, 90);
  const name = existing?.name ?? eventName(p);
  const place =
    p.venues && p.venues !== "Home" && !p.venues.includes(" or ")
      ? p.venues
      : (p.city ?? "Venue to be chosen");
  const functions: FunctionDay[] =
    p.functions.length > 1
      ? p.functions.map((f) => ({
          id: f.toLowerCase(),
          label: f,
          date: addDays(date, FUNCTION_OFFSET[f] ?? 0),
          part:
            f === "Ceremony" && p.functions.includes("Reception")
              ? "AM"
              : f === "Reception"
                ? "PM"
                : undefined,
          place,
        }))
      : [];
  const tasks: Task[] = FIRST_TASKS[kind].map(([title, week], i) => {
    const due = addDays(TODAY, week * 7);
    return { id: `t${i + 1}`, title, who: "You", due: due < date ? due : addDays(date, -1), done: false };
  });
  const venueBooked = p.venueStatus === "Booked";
  const categories = plan.budget.lines.map((l) => ({
    id: slug(l.name),
    name: l.name,
    planned: l.amount,
    spent: 0,
    status: "Not started",
    tone: "idle" as const,
    items: [],
  }));
  const catering = categories[0];
  const whatIfRates =
    catering && p.guests
      ? [{ category: catering.name, perGuest: Math.round(catering.planned / p.guests) }]
      : [];
  const where = p.venues === "Home" ? "at home" : (p.city ?? "");
  const meta = [KIND_LABEL[kind], where, shortDate(date)].filter(Boolean).join(" · ");
  return {
    // Ids are shared by every account on the server, so the suffix is random rather than a timestamp.
    id: existing?.id ?? `${slug(name)}-${crypto.randomUUID().slice(0, 8)}`,
    kind,
    layout: "personal",
    name,
    role: "OWNER",
    hue: HUE[kind],
    eyebrow: [KIND_LABEL[kind], p.city, longDate(date)].filter(Boolean).join(" · "),
    navMeta: meta,
    listMeta: [p.style, where, longDate(date), p.guests ? `${p.guests} guests` : undefined]
      .filter(Boolean)
      .join(" · "),
    date,
    guests: p.guests ?? 0,
    countdown: {
      label: kind === "wedding" ? "Countdown to the wedding" : "Countdown to the day",
      line: `${longDate(date)} · ${place}`,
      theme: kind === "wedding" ? "maroon" : "indigo",
    },
    functions,
    people: [{ initials: user.initials, bg: "#1F5F6B", fg: "#FFFFFF", name: user.name }],
    morePeople: 0,
    pace: "A fresh plan: nothing is late yet",
    budgetScore: 0.5,
    budgetNote: "nothing spent yet",
    budget: {
      total: plan.budget.total,
      committed: 0,
      categories,
      payments: [],
      savings: [],
      whatIf: whatIfRates.length
        ? {
            baseGuests: p.guests ?? 0,
            min: Math.max(10, Math.round((p.guests ?? 0) * 0.4)),
            max: Math.round((p.guests ?? 0) * 1.6),
            rates: whatIfRates,
          }
        : undefined,
      source: `Split suggested by Plannr. ${plan.basis}`,
    },
    tasks: { total: plan.tasks, doneBefore: 0, list: tasks },
    vendors: {
      booked: venueBooked && plan.vendors.includes("Venue") ? ["Venue"] : [],
      talking: [],
      needed: plan.vendors.filter((v) => !(venueBooked && v === "Venue")),
    },
    rsvp: { total: p.guests ?? 0, invited: 0, confirmed: 0, declined: 0, pending: 0, notSent: p.guests ?? 0 },
    notices: [],
    assistant: {
      intro: "",
      chips: ["What should I do this week?", "Why is readiness this low?", "Where are we over?"],
      thread: [
        {
          id: "welcome",
          role: "ai",
          text: "Your plan is live. Ask me anything about it, or tell me what to change. Nothing moves until you approve it.",
        },
      ],
    },
    home: {
      budgetNote: { text: "Nothing spent yet", tone: "idle" },
      readinessNote: { text: "First draft accepted", tone: "idle" },
    },
  };
}
