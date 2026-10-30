import { BadRequest, clip, int, isObject, isoDate, oneOf, str, strList, VOICE } from "./promptKit";

/** Ideas for one event from a brief the browser builds; guests appear as counts only. */

export const EFFORTS = ["low", "medium", "high"] as const;
const MAX_IDEAS = 6;

export interface IdeasRequest {
  brief: unknown;
  /** Titles already on the ideas board, so the model suggests something new. */
  avoid: string[];
  today: string;
}

export function ideasRequest(body: unknown): IdeasRequest {
  if (!isObject(body) || !isObject(body.brief)) throw new BadRequest("brief is required");
  return {
    brief: body.brief,
    avoid: strList(body.avoid, 40, 160),
    today: isoDate(body.today) ?? new Date().toISOString().slice(0, 10),
  };
}

export const ideasSchema = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      description: "Four to six ideas, each answering a different detail of this event",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "The idea in under ten words" },
          detail: { type: "string", description: "One or two sentences on what to do" },
          because: {
            type: "string",
            description: "The detail of this event it answers, in under 20 words",
          },
          cost: { type: "integer", description: "Rough extra cost in rupees, 0 when it costs nothing extra" },
          effort: { type: "string", enum: [...EFFORTS] },
          category: {
            type: "string",
            description: "The budget line it belongs to, named exactly as in the brief, or empty",
          },
        },
        required: ["title", "detail", "because", "effort"],
      },
    },
  },
  required: ["ideas"],
} as const;

export function ideasPrompt(r: IdeasRequest): { system: string; user: string } {
  return {
    system: `${VOICE}
You suggest ideas that make one event feel like the family's own: theme, décor, food, guest comfort, fun,
keepsakes and ways to save. Every idea answers a specific detail in the brief (the month, the functions and
where they are, the guest count, meals, care needs, budget lines or the family's notes) and "because" names it.
Nothing generic that would suit any event. Keep costs realistic and inside the budget lines. Today is ${r.today}.`,
    user: `Event brief: ${clip(r.brief, 6000)}${
      r.avoid.length ? `\nAlready on their ideas board, so suggest different ones: ${r.avoid.join("; ")}` : ""
    }`,
  };
}

export interface IdeaSuggestion {
  title: string;
  detail: string;
  because: string;
  effort: (typeof EFFORTS)[number];
  cost?: number;
  category?: string;
}

/** Keeps complete ideas only, none the board already has, and fails when nothing is left. */
export function sanitizeIdeas(raw: unknown, avoid: string[] = []): { ideas: IdeaSuggestion[] } {
  const r = isObject(raw) ? raw : {};
  const seen = new Set(avoid.map((t) => t.toLowerCase()));
  const ideas: IdeaSuggestion[] = [];
  for (const x of (Array.isArray(r.ideas) ? r.ideas : []).filter(isObject)) {
    const title = str(x.title, 120);
    const detail = str(x.detail, 320);
    const because = str(x.because, 200);
    if (!title || !detail || !because || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const cost = int(x.cost, 1, 10_000_000);
    const category = str(x.category, 60);
    ideas.push({
      title,
      detail,
      because,
      effort: oneOf(x.effort, EFFORTS) ?? "medium",
      ...(cost ? { cost } : {}),
      ...(category ? { category } : {}),
    });
    if (ideas.length >= MAX_IDEAS) break;
  }
  if (!ideas.length) throw new Error("No usable ideas");
  return { ideas };
}
