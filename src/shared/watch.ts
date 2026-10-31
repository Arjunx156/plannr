import type { CommunityEvent, PersonalEvent, PlannrEvent } from "../data/types";
import { longDate } from "../lib/dates";
import { COMMUNITY_RULES } from "./communityWatch";
import { overdueTasks, PERSONAL_RULES, vendorsNeeded } from "./personalWatch";
import type { Rule, Watch } from "./watchRule";

const SHARED_RULES: Rule<PersonalEvent | CommunityEvent>[] = [overdueTasks, vendorsNeeded];

/** Everything worth the planner's attention in one upcoming event, most urgent first. */
export function watchPlan(ev: PlannrEvent, today: string): Watch[] {
  if (ev.layout === "empty" || ev.archived || ev.date < today) return [];
  const own =
    ev.layout === "personal"
      ? PERSONAL_RULES.flatMap((rule) => rule(ev, today))
      : COMMUNITY_RULES.flatMap((rule) => rule(ev, today));
  const shared = SHARED_RULES.flatMap((rule) => rule(ev, today));
  return [...own, ...shared].sort((a, b) => a.rank - b.rank);
}

// ---------------------------------------------------------------- weather

/** Rain likely on a function day in the next ten days: worth a plan B. */
export interface RainRisk {
  fnId: string;
  label: string;
  date: string;
  chance: number;
}

/** Forecast chance of rain (percent) worth planning around. */
const RAIN_CHANCE = 60;

/** A notice, with a one-tap checklist item, for each function day where rain is likely. */
export function rainWatch(ev: PlannrEvent, risks: RainRisk[]): Watch[] {
  return risks
    .filter((r) => r.chance >= RAIN_CHANCE)
    .map((r) => ({
      id: `rain:${r.fnId}:${r.date}`,
      tone: "warn" as const,
      label: "Weather",
      text: `Rain is likely on ${longDate(r.date)}, the day of the ${r.label}: ${r.chance}% chance in the forecast.`,
      why: "Forecast from Open-Meteo for the venue's area.",
      primary: {
        label: "Add rain cover to the checklist",
        kind: "apply" as const,
        actions: [
          {
            type: "addRecord" as const,
            eventId: ev.id,
            coll: "checklist" as const,
            record: {
              id: `rain-${r.fnId}-${r.date}`,
              fnId: r.fnId,
              label: `Rain cover and umbrellas for the ${r.label}`,
              done: false,
            },
          },
        ],
        done: "Added to the day's checklist.",
      },
      rank: 4,
    }));
}
