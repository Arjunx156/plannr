import type { Household } from "../guestTypes";
import type { PlanRecords } from "../recordTypes";
import { answerFor } from "./answers";

/**
 * The demo birthday's guests, vendors and run sheet.
 * Dates are written for the story day and move with the rest of the demo; times of day stay.
 */

export const BIRTHDAY_PAYMENT_LINKS: Record<string, { categoryId: string; vendorId?: string }> = {
  bp1: { categoryId: "gifts", vendorId: "return-gifts" },
  bp2: { categoryId: "entertainer", vendorId: "show" },
  bp3: { categoryId: "cake", vendorId: "cake" },
  bp4: { categoryId: "cake", vendorId: "cake" },
  bp5: { categoryId: "entertainer", vendorId: "show" },
};

const BDAY: [string, number, number | "no" | null, Partial<Household>?][] = [
  ["Kabir's family", 3, 3, { needs: "Kabir is allergic to nuts" }],
  ["Diya's family", 3, 3],
  ["Ishaan's family", 2, 2],
  ["Meher & Myra (twins)", 4, 4],
  ["Advik's family", 3, null],
  ["Sara's family", 3, 3, { meal: "nonveg" }],
  ["Neighbours from B-block", 6, 5],
  ["Aarav's class friends (8)", 12, null, { note: "Collecting names from the class WhatsApp group" }],
  ["Ammachi & Appooppan", 2, 2, { meal: "veg" }],
  ["Vivek's cousins", 5, "no"],
  ["Football club friends", 7, 4],
];

export const birthdayRecords: PlanRecords = {
  households: BDAY.map(([name, expected, answer, extra], i) => ({
    id: `bh${i + 1}`,
    name,
    side: i === 8 || i === 9 ? "Family" : "Friends",
    expected,
    functions: ["day"],
    rsvp: {
      day: answerFor(answer),
    },
    invitedAt: "2026-09-15",
    ...(answer !== null ? { respondedAt: "2026-09-20" } : {}),
    ...extra,
  })),
  vendorList: [
    {
      id: "show",
      category: "Planetarium show",
      name: "Starlab Kids",
      stage: "booked",
      phone: "919812300456",
      quotes: [{ id: "show-q1", amount: 8000, label: "45-minute dome show for 30 kids", on: "2026-09-10" }],
      chosenQuote: "show-q1",
      arrivals: [{ fnId: "day", time: "15:00", note: "Dome needs 4 × 4 m and one plug point" }],
      categoryId: "entertainer",
    },
    {
      id: "return-gifts",
      category: "Return gifts",
      name: "Toy Planet, Edappally",
      stage: "booked",
      quotes: [{ id: "rg-q1", amount: 4500, label: "30 rocket kits", on: "2026-09-08" }],
      chosenQuote: "rg-q1",
      categoryId: "gifts",
    },
    {
      id: "cake",
      category: "Cake",
      name: "Bake Street",
      stage: "quoted",
      phone: "919633400789",
      upi: "bakestreet@okhdfc",
      quotes: [{ id: "cake-q1", amount: 4500, label: "3 kg rocket cake, nut-free", on: "2026-09-19" }],
      categoryId: "cake",
    },
    { id: "snacks", category: "Snacks caterer", name: "", stage: "needed", quotes: [], categoryId: "food" },
  ],
  runsheet: [
    {
      id: "br1",
      fnId: "day",
      time: "14:00",
      title: "Decorations up: balloons and the star ceiling",
      owner: "Vivek",
    },
    {
      id: "br2",
      fnId: "day",
      time: "15:00",
      title: "Starlab dome arrives and sets up",
      owner: "Starlab Kids",
      phone: "919812300456",
    },
    {
      id: "br3",
      fnId: "day",
      time: "16:00",
      title: "Guests arrive, space passports at the door",
      owner: "Priya",
    },
    {
      id: "br4",
      fnId: "day",
      time: "16:30",
      title: "Planetarium show, two groups of 15",
      owner: "Starlab Kids",
    },
    { id: "br5", fnId: "day", time: "17:30", title: "Cake and candles", owner: "Priya" },
    { id: "br6", fnId: "day", time: "18:00", title: "Mini dosas and juice", owner: "Vivek" },
    { id: "br7", fnId: "day", time: "18:45", title: "Return gifts as kids leave", owner: "Ammachi" },
  ],
  checklist: [
    { id: "bc1", fnId: "day", label: "Candles and a lighter", owner: "Priya", done: false },
    { id: "bc2", fnId: "day", label: "Extension cord for the dome", owner: "Vivek", done: false },
    { id: "bc3", fnId: "day", label: "First-aid kit", owner: "Priya", done: true },
  ],
  memory: [{ id: "bm1", text: "Everything nut-free: Kabir is allergic" }],
  site: {
    published: false,
    story: "Aarav is turning six and taking his friends to space. Helmets optional.",
  },
};
