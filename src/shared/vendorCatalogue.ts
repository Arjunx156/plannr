import type { Kind } from "../data/baseTypes";

/**
 * The two planning views the brief asks for, worked out from the plan itself:
 * a vendor checklist with a book-by date for each vendor, and a timeline that puts
 * tasks, payments, bookings and the functions in one dated sequence.
 */
// ---------------------------------------------------------------- vendor checklist
interface CatalogueEntry {
  category: string;
  /** Words that match this entry in a vendor's category, lower case. */
  match: string[];
  /** How long before the day this vendor is usually booked. */
  leadDays: number;
  why: string;
  /** Only when the event has one of these functions. */
  onlyWith?: string[];
}
/** What each kind of event usually books, and how far ahead. */
export const CATALOGUE: Record<Kind, CatalogueEntry[]> = {
  wedding: [
    { category: "Venue", match: ["venue", "hall"], leadDays: 180, why: "Good halls go a season ahead" },
    {
      category: "Catering",
      match: ["cater", "sadhya", "food"],
      leadDays: 150,
      why: "Sets the per-plate cost",
    },
    {
      category: "Photography",
      match: ["photo", "video"],
      leadDays: 150,
      why: "Popular teams fill wedding dates early",
    },
    {
      category: "Attire",
      match: ["attire", "saree", "outfit"],
      leadDays: 120,
      why: "Weaving and fittings take weeks",
    },
    {
      category: "Décor",
      match: ["décor", "decor", "mandapam"],
      leadDays: 90,
      why: "Needs the venue layout first",
    },
    { category: "Makeup & hair", match: ["makeup", "hair"], leadDays: 90, why: "Trials before the day" },
    {
      category: "Music",
      match: ["music", "melam", "dj", "band", "nadaswaram"],
      leadDays: 90,
      why: "Artists travel",
    },
    {
      category: "Invitations",
      match: ["invitation", "card", "print"],
      leadDays: 75,
      why: "Posted six weeks out",
    },
    {
      category: "Priest",
      match: ["priest", "vadhyar", "pandit", "officiant"],
      leadDays: 60,
      why: "Confirms the muhurtham",
    },
    {
      category: "Mehendi artist",
      match: ["mehendi", "henna"],
      leadDays: 45,
      why: "Busy in the season",
      onlyWith: ["mehendi"],
    },
    {
      category: "Guest transport",
      match: ["transport", "bus", "car"],
      leadDays: 30,
      why: "After the guest count settles",
    },
  ],
  birthday: [
    {
      category: "Venue",
      match: ["venue", "hall", "planetarium"],
      leadDays: 30,
      why: "Weekend slots go first",
    },
    { category: "Food", match: ["cater", "snack", "food"], leadDays: 14, why: "Needs the final head count" },
    {
      category: "Décor",
      match: ["décor", "decor", "balloon"],
      leadDays: 14,
      why: "Theme props are made to order",
    },
    {
      category: "Entertainment",
      match: ["entertain", "magic", "show", "games"],
      leadDays: 21,
      why: "Weekend performers book out",
    },
    { category: "Cake", match: ["cake", "bake"], leadDays: 10, why: "Theme cakes need a design" },
    { category: "Return gifts", match: ["gift", "favour"], leadDays: 10, why: "Bulk orders take a week" },
    {
      category: "Photography",
      match: ["photo", "video"],
      leadDays: 14,
      why: "One person free to take pictures",
    },
  ],
  community: [
    {
      category: "Venue and permission",
      match: ["venue", "ground", "hall"],
      leadDays: 90,
      why: "Permits need the venue",
    },
    {
      category: "Sound and lights",
      match: ["sound", "light", "pa "],
      leadDays: 45,
      why: "Licensed by the police",
    },
    {
      category: "Pandal and seating",
      match: ["pandal", "tent", "seating", "chairs"],
      leadDays: 45,
      why: "Shared across festivals",
    },
    {
      category: "Food",
      match: ["cater", "food", "prasad", "sadhya"],
      leadDays: 30,
      why: "Bulk orders and gas cylinders",
    },
    {
      category: "Printing",
      match: ["print", "banner", "poster", "flyer"],
      leadDays: 21,
      why: "Banners go up two weeks out",
    },
    {
      category: "Security and first aid",
      match: ["security", "first aid", "ambulance"],
      leadDays: 21,
      why: "Required for crowds",
    },
    {
      category: "Cleaning",
      match: ["clean", "waste", "sanitation"],
      leadDays: 21,
      why: "Waste must be cleared the same night",
    },
  ],
  other: [
    { category: "Venue", match: ["venue", "hall"], leadDays: 60, why: "Everything follows the venue" },
    { category: "Food", match: ["cater", "food", "snack"], leadDays: 30, why: "Sets the per-plate cost" },
    { category: "Décor", match: ["décor", "decor"], leadDays: 21, why: "After the venue is fixed" },
    { category: "Photography", match: ["photo", "video"], leadDays: 21, why: "Someone to keep the memories" },
  ],
};
/** Lead time for a vendor the catalogue doesn't know. */
export const DEFAULT_LEAD = 30;
