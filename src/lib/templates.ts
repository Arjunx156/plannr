import type { Profile } from "../data/types";
import { emptyProfile, parseDescription } from "./intake";

export type TemplateId = "wedding" | "birthday" | "mela";

interface Template {
  label: string;
  prompt: string;
  extras: string;
  priorities: string[];
  cuts: string[];
  moods: string[];
  colours: string[];
}

export const TEMPLATES: Record<TemplateId, Template> = {
  wedding: {
    label: "South Indian wedding",
    prompt:
      "Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh, end of April next year. It's for my sister Ananya and Rohan.",
    extras:
      "Kayal Heritage Centre in Maradu or Lotus Banquets. Also mehendi and haldi the days before. Two grandparents use wheelchairs.",
    priorities: ["Food", "Photography", "Ceremony décor"],
    cuts: ["Reception DJ", "Favours"],
    moods: ["Temple-inspired", "Elegant", "Warm"],
    colours: ["Kasavu gold", "Ivory", "Mango leaf"],
  },
  birthday: {
    label: "Kids' birthday",
    prompt:
      "Space-themed 6th birthday at home in Kakkanad for Aarav, 30 kids and 20 adults, ₹40,000, in three weeks.",
    extras: "Three kids have nut allergies.",
    priorities: ["Entertainer", "Cake", "Return gifts"],
    cuts: ["Second balloon arch"],
    moods: ["Playful", "Vibrant"],
    colours: ["Peacock", "Kasavu gold"],
  },
  mela: {
    label: "Diwali mela",
    prompt:
      "Diwali mela for our society in Kakkanad: stalls and a cultural night, 600 people, ₹2.5 lakh, 7 Nov, 12 volunteers.",
    extras: "Rangoli contest at 4 pm. Society grounds are booked.",
    priorities: ["Stalls", "Cultural night", "Safety"],
    cuts: ["Fireworks"],
    moods: ["Vibrant", "Grand"],
    colours: ["Kumkum", "Kasavu gold", "Mango leaf"],
  },
};

export function templateProfile(id: TemplateId): Profile {
  const t = TEMPLATES[id];
  const p = parseDescription(t.extras, parseDescription(t.prompt, emptyProfile()));
  return {
    ...p,
    venueStatus: p.venueStatus ?? (id === "mela" ? "Booked" : p.venueStatus),
    venues: p.venues ?? (id === "mela" ? "Society grounds" : p.venues),
    priorities: t.priorities,
    cuts: t.cuts,
    moods: t.moods,
    colours: t.colours,
  };
}
