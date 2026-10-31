import type { Profile } from "../data/types";
import { post } from "./ai";
import { TODAY } from "./dates";
import { FUNCTION_ORDER } from "./intake";

// ---------------------------------------------------------------- intake

export type AiIntake = Partial<Omit<Profile, "inspiration" | "priorities" | "cuts">> & { reply?: string };
export function extractWithAi(
  text: string,
  profile: Profile,
  asking?: string,
): Promise<AiIntake | undefined> {
  return post<AiIntake>("intake", { text, profile, asking, today: TODAY }, 12000);
}
function union(a: string[], b: string[] | undefined): string[] {
  const out = [...a];
  for (const x of b ?? []) if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  return out;
}
const words = (s: string) => s.toLowerCase().match(/[a-z]{4,}/g) ?? [];
/** "Grandmother uses a wheelchair" is already covered by "Wheelchair access". */
function covered(existing: string[], need: string): boolean {
  const mine = new Set(existing.flatMap(words));
  return words(need).some((w) => mine.has(w));
}

/**
 * Fills what the on-device parser missed with what Gemini read. The parser wins where
 * both found something: it is exact on the patterns it knows, and the model covers the
 * long tail of phrasings it doesn't.
 */
export function mergeAiProfile(local: Profile, ai: AiIntake | undefined): Profile {
  if (!ai) return local;
  const kind = local.kind ?? ai.kind;
  const date = local.date
    ? { date: local.date, dateText: local.dateText }
    : { date: ai.date, dateText: ai.dateText };
  const fns = new Set(union(local.functions, ai.functions));
  if (kind === "wedding") fns.add("Ceremony");
  return {
    ...local,
    kind,
    style: local.style ?? ai.style,
    names: local.names ?? ai.names,
    city: local.city ?? ai.city,
    date: date.date,
    dateText: date.date ? (date.dateText ?? date.date) : undefined,
    guests: local.guests ?? ai.guests,
    budget: local.budget ?? ai.budget,
    venueStatus: local.venueStatus ?? ai.venueStatus,
    venues: local.venues ?? ai.venues,
    functions: FUNCTION_ORDER.filter((f) => fns.has(f)),
    traditions: local.traditions ?? ai.traditions,
    needs: union(
      local.needs,
      ai.needs?.filter((n) => !covered(local.needs, n)),
    ),
    moods: union(local.moods, ai.moods),
    colours: union(local.colours, ai.colours),
    coPlanners: union(local.coPlanners, ai.coPlanners),
  };
}
