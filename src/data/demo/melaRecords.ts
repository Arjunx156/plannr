import type { Pass, Stall, Vendor } from "../types";

/**
 * The demo mela's stalls, passes, sponsors, vendors and run sheet.
 * Dates are written for the story day and move with the rest of the demo; times of day stay.
 */

const TOWERS = ["A", "B", "C", "D"];
/** Flats with gate passes: four towers, deterministic family sizes adding up to a full mela. */
function passes(): Pass[] {
  const out: Pass[] = [];
  let n = 0;
  for (const t of TOWERS)
    for (let floor = 1; floor <= 8; floor++)
      for (const unit of [1, 2, 3, 4]) {
        if ((floor * 7 + unit * 3 + t.charCodeAt(0)) % 10 < 3) continue;
        n += 1;
        out.push({
          id: `pass-${t}${floor}0${unit}`,
          name: `Flat ${t}-${floor}0${unit}`,
          count: 2 + ((floor + unit + n) % 4),
        });
      }
  return out;
}

const STALL_NAMES: [string, string, string][] = [
  ["Ammu's Pickles", "Lakshmi", "Food"],
  ["Malabar Biryani Point", "Faisal", "Food"],
  ["Kerala Handloom Corner", "Sreeja", "Clothes"],
  ["Diya & Rangoli Supplies", "Ramesh", "Festive"],
  ["Kids' Games Zone", "Society youth club", "Games"],
  ["Chai & Pazhampori", "Thomas", "Food"],
  ["Terracotta Lamps", "Anil", "Festive"],
  ["Organic Greens", "Green Leaf Organics", "Food"],
  ["Mehendi Artist", "Nasreen", "Services"],
  ["Book Swap", "Library committee", "Books"],
  ["Ice Cream Cart", "Joy's", "Food"],
  ["Jewellery & Bangles", "Fathima", "Accessories"],
  ["Plant Nursery", "Kakkanad Greens", "Plants"],
  ["Homemade Sweets", "Meera", "Food"],
  ["Balloon Art", "Vishnu", "Games"],
  ["Photo Booth", "Society youth club", "Services"],
  ["Spice Box", "Varghese", "Food"],
  ["Crafts by Kids", "Sunday school", "Crafts"],
  ["Momo Corner", "Tenzin", "Food"],
  ["Coconut Shell Crafts", "Ravi", "Crafts"],
];

function stalls(): Stall[] {
  return STALL_NAMES.map(([name, owner, category], i) => ({
    id: `st${i + 1}`,
    name,
    owner,
    category,
    fee: 2500,
    // 18 confirmed, the first 12 paid; the last two are new requests.
    status: i < 18 ? "confirmed" : "requested",
    paid: i < 12,
  }));
}

const melaVendors: Vendor[] = [
  {
    id: "mv1",
    category: "Venue",
    name: "Society grounds (Green Valley)",
    stage: "booked",
    quotes: [{ id: "mq1", amount: 0, label: "Free for society events" }],
    chosenQuote: "mq1",
  },
  {
    id: "mv2",
    category: "Sound & lights",
    name: "Lumen Events",
    contact: "Vinod",
    phone: "+91 98470 31212",
    stage: "quoted",
    quotes: [
      { id: "mq2", amount: 62000, label: "Stage sound, 24 lights, generator", terms: "₹25,000 advance" },
    ],
  },
  {
    id: "mv3",
    category: "Pandal & seating",
    name: "Kakkanad Tent House",
    stage: "booked",
    quotes: [{ id: "mq3", amount: 38000, label: "Pandal for 400, 300 chairs" }],
    chosenQuote: "mq3",
  },
  {
    id: "mv4",
    category: "Printing & banners",
    name: "Print Point",
    stage: "enquired",
    quotes: [],
  },
  {
    id: "mv5",
    category: "Security & first aid",
    name: "",
    stage: "needed",
    quotes: [],
    notes: "Dr. Leela will run the first-aid desk; still need two guards for the gate",
  },
];

export const melaRecords = {
  vendorList: melaVendors,
  stallList: stalls(),
  passList: passes(),
  sponsors: [
    { id: "sp1", name: "Kakkanad Motors", tier: "Gold", amount: 30000, received: 30000 },
    { id: "sp2", name: "Green Leaf Organics", tier: "Silver", amount: 10000, received: 10000 },
    { id: "sp3", name: "Malabar Jewellers", tier: "Gold", amount: 30000, received: 0 },
  ],
  runsheet: [
    { id: "mr1", fnId: "day", time: "14:00", title: "Stall setup opens", owner: "Rekha" },
    { id: "mr2", fnId: "day", time: "15:30", title: "Security briefing at the main gate", owner: "Joseph" },
    { id: "mr3", fnId: "day", time: "16:00", title: "Gates open; rangoli contest starts", owner: "Rekha" },
    {
      id: "mr4",
      fnId: "day",
      time: "17:30",
      title: "Sound check on the main stage",
      owner: "Arjun",
      note: "Lumen Events",
    },
    { id: "mr5", fnId: "day", time: "18:00", title: "Rangoli judging", owner: "Committee" },
    { id: "mr6", fnId: "day", time: "19:00", title: "Cultural night begins", owner: "Arjun" },
    { id: "mr7", fnId: "day", time: "21:45", title: "Prize distribution", owner: "President" },
    { id: "mr8", fnId: "day", time: "22:00", title: "Sound off; clean-up crew starts", owner: "Thomas" },
  ],
  checklist: [
    { id: "mc1", fnId: "day", label: "Police permission copy at the gate", owner: "Secretary", done: false },
    { id: "mc2", fnId: "day", label: "Fire extinguishers at the diya stalls", owner: "Thomas", done: false },
    { id: "mc3", fnId: "day", label: "Prize envelopes and trophies", owner: "Rekha", done: false },
  ],
  memory: [
    { id: "mm1", text: "Sound off by 10 pm sharp: residents' rule" },
    { id: "mm2", text: "No plastic plates at food stalls" },
  ],
  site: {
    published: false,
    story:
      "Green Valley's annual mela: 30 stalls, a rangoli contest and a cultural night on the society grounds. Residents and guests welcome.",
  },
};
