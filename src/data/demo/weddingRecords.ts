import type { Household } from "../guestTypes";
import type { PlanRecords } from "../recordTypes";
import type { Vendor } from "../vendorTypes";
import { answerFor } from "./answers";

/**
 * The demo wedding's guests, vendors, run sheets and gifts.
 * Dates are written for the story day and move with the rest of the demo; times of day stay.
 */

type Fn = "mehendi" | "haldi" | "ceremony" | "reception";
const ALL: Fn[] = ["mehendi", "haldi", "ceremony", "reception"];
const MAIN: Fn[] = ["ceremony", "reception"];

/** [name, side, people, functions, answer, extra] — answer is how many said yes, "no", or null for waiting. */
type Row = [string, "A" | "R", number, Fn[], number | "no" | null, Partial<Household>?];

const ROWS: Row[] = [
  ["Menon family, Tripunithura", "A", 6, ALL, 6, { phone: "919847012345", meal: "veg" }],
  [
    "Ammachi & Valiachan, Thrissur",
    "A",
    2,
    ALL,
    2,
    { needs: "Ammachi uses a wheelchair: ground floor, ramp to the hall", meal: "veg", stay: true },
  ],
  ["Nair family, Thrissur", "A", 4, MAIN, null, { phone: "919446055501" }],
  ["Varghese family, Kottayam", "A", 3, ["reception"], null, { needs: "1 wheelchair user" }],
  ["Pillai family, Ernakulam", "A", 5, MAIN, 5, { meal: "nonveg" }],
  ["Krishnan family, Palakkad", "A", 4, ALL, 4, { stay: true, room: "crowne" }],
  [
    "Ananya's college friends, Bengaluru",
    "A",
    9,
    ["mehendi", "reception"],
    7,
    { pickup: "Ernakulam Junction, Thu 6:10 am", stay: true, room: "crowne" },
  ],
  ["Kurup family, Kollam", "A", 4, MAIN, null],
  ["Warrier family, Kozhikode", "A", 3, ["ceremony"], "no"],
  ["Ananya's office friends, Infopark", "A", 12, ["reception"], 10],
  ["Unni & family, Aluva", "A", 4, MAIN, 4],
  [
    "Menon cousins, Chennai",
    "A",
    6,
    ALL,
    6,
    { stay: true, room: "homestay", pickup: "Ernakulam Junction, Thu 2:40 pm" },
  ],
  ["Neighbours, Tripunithura", "A", 10, ["haldi", "ceremony"], 8],
  ["Lakshmi teacher's family", "A", 3, ["ceremony"], null, { lang: "ml" }],
  ["Thampi family, Thiruvananthapuram", "A", 4, MAIN, null, { lang: "ml" }],
  ["Iyer family, Coimbatore", "A", 3, ["reception"], 3, { lang: "ta" }],
  ["Gopalan family, Thrissur", "A", 5, ["ceremony"], "no"],
  ["Ananya's dance class friends", "A", 6, ["mehendi"], 6],
  ["Extended family, Tripunithura", "A", 20, MAIN, 18, { lang: "ml" }],
  ["Temple committee members", "A", 12, ["ceremony"], null, { lang: "ml" }],
  ["Rohan's parents, Kakkanad", "R", 4, ALL, 4, { phone: "919895066602" }],
  [
    "Rohan's family, Dubai",
    "R",
    18,
    MAIN,
    null,
    { stay: true, room: "crowne", pickup: "Cochin airport, Thu 3:15 am (EK 530)", phone: "971501234567" },
  ],
  ["Nair family, Kakkanad", "R", 5, MAIN, 5],
  ["Rohan's school friends", "R", 10, ["reception"], null],
  ["Joseph family, Kaloor", "R", 4, ["reception"], 4, { meal: "nonveg" }],
  ["Rohan's office, Infopark", "R", 15, ["reception"], 12],
  ["Mathew family, Bengaluru", "R", 4, MAIN, null, { stay: true }],
  ["Kartha family, Alappuzha", "R", 5, ["ceremony"], 5],
  ["Rohan's grandmother, Kottayam", "R", 2, MAIN, 2, { needs: "Needs a seat near the front", meal: "veg" }],
  ["Hari & family, Muscat", "R", 4, MAIN, null, { stay: true, pickup: "Cochin airport, Fri 9:40 pm" }],
  ["Panicker family, Kollam", "R", 4, ["reception"], null],
  ["Cricket club friends", "R", 8, ["reception"], null],
  ["Rohan's cousins, Pune", "R", 6, MAIN, 6, { stay: true, room: "homestay" }],
  ["Shenoy family, Mangaluru", "R", 3, ["reception"], null],
  ["Rohan's relatives, Kakkanad", "R", 25, MAIN, null],
  ["Family friends, Ernakulam", "R", 26, ["reception"], null],
];

const SIDE = { A: "Ananya's family", R: "Rohan's family" } as const;

/** Households not yet sent their invitation, so the guest list shows what's still to do. */
const NOT_SENT = new Set(["Panicker family, Kollam", "Cricket club friends", "Family friends, Ernakulam"]);

export function households(): Household[] {
  return ROWS.map(([name, side, expected, functions, answer, extra], i) => {
    const rsvp: Household["rsvp"] = {};
    for (const fn of functions) rsvp[fn] = answerFor(answer);
    const sent = !NOT_SENT.has(name);
    return {
      id: `h${i + 1}`,
      name,
      side: SIDE[side],
      expected,
      functions: [...functions],
      rsvp,
      ...(sent ? { invitedAt: "2026-09-14" } : {}),
      ...(answer !== null && sent ? { respondedAt: "2026-09-21" } : {}),
      ...extra,
    };
  });
}

const weddingVendors: Vendor[] = [
  {
    id: "venue",
    category: "Venue",
    name: "Kayal Heritage Centre",
    stage: "booked",
    phone: "914842700100",
    contact: "Suresh (events manager)",
    upi: "kayalheritage@okaxis",
    categoryId: "venue",
    quotes: [{ id: "venue-q1", amount: 320000, label: "Hall and lawns, 2 days", on: "2026-07-30" }],
    chosenQuote: "venue-q1",
    arrivals: [
      { fnId: "ceremony", time: "06:30", note: "Hall opens for décor and the caterer" },
      { fnId: "reception", time: "16:00", note: "Lawn lights on by 6:30 pm" },
    ],
    needs: "Generator backup confirmed for the reception lawns",
  },
  {
    id: "decor",
    category: "Décor",
    name: "Mangalya Décor",
    stage: "booked",
    phone: "919447011223",
    contact: "Bindu",
    upi: "mangalyadecor@okicici",
    categoryId: "decor",
    quotes: [
      {
        id: "decor-q1",
        amount: 290000,
        label: "Mandapam, reception stage, entrance and tables",
        on: "2026-08-20",
      },
    ],
    chosenQuote: "decor-q1",
    arrivals: [
      { fnId: "ceremony", time: "05:30", note: "Mandapam flowers go up last, after the venue sweep" },
      { fnId: "reception", time: "15:00" },
    ],
    needs: "Two extension boards at the stage; access from the side gate",
  },
  {
    id: "chenda",
    category: "Chenda melam",
    name: "Sree Durga Chenda Sangham",
    stage: "booked",
    phone: "919961033445",
    contact: "Unni (troupe leader)",
    categoryId: "entertainment",
    quotes: [
      { id: "chenda-q1", amount: 45000, label: "12 artists, procession and muhurtham", on: "2026-09-01" },
    ],
    chosenQuote: "chenda-q1",
    arrivals: [{ fnId: "ceremony", time: "09:15", note: "Procession starts 9:45 from the east gate" }],
    needs: "Lunch for 12 after the muhurtham; a room to change",
    lang: "ml",
  },
  {
    id: "catering",
    category: "Catering",
    name: "Sree Annapoorna",
    stage: "quoted",
    phone: "914842355500",
    contact: "Mohanan",
    upi: "sreeannapoorna@oksbi",
    categoryId: "catering",
    quotes: [
      {
        id: "cat-q1",
        amount: 2016,
        perGuest: true,
        label: "Sree Annapoorna · 26-item sadhya",
        inclusions: "Two payasams, banana leaves, serving staff, water",
        terms: "30% advance, balance 15 days before. Final count 7 days before.",
        on: "2026-08-28",
      },
      {
        id: "cat-q2",
        amount: 1850,
        perGuest: true,
        label: "Kerala Kitchen Caterers · 22-item sadhya",
        inclusions: "One payasam, leaves, staff",
        terms: "50% advance. Count changes up to 3 days before.",
        on: "2026-09-04",
      },
      {
        id: "cat-q3",
        amount: 1896,
        perGuest: true,
        label: "Sree Annapoorna · 22-item sadhya",
        inclusions: "Both payasams kept, 4 fewer curries",
        terms: "Same as the 26-item menu",
        on: "2026-09-10",
      },
    ],
    arrivals: [{ fnId: "ceremony", time: "07:00", note: "First sitting at 11:15" }],
    needs: "Final headcount 7 days before; water supply at the back kitchen",
    lang: "ml",
  },
  {
    id: "photography",
    category: "Photography",
    name: "",
    stage: "quoted",
    categoryId: "photo",
    quotes: [
      {
        id: "ph-q1",
        amount: 240000,
        label: "Lightbox Studios · photo + video, 4 functions",
        inclusions: "2 photographers, 1 videographer, drone, album of 60 pages",
        terms: "30% advance to block dates; balance on delivery",
        on: "2026-09-08",
      },
      {
        id: "ph-q2",
        amount: 200000,
        label: "Frames by Arun · photo + video, 4 functions",
        inclusions: "2 photographers, 1 videographer, album of 40 pages",
        terms: "₹50,000 advance; balance on the day",
        on: "2026-09-12",
      },
      {
        id: "ph-q3",
        amount: 180000,
        label: "Candid Kerala · photo only + highlight film",
        inclusions: "2 photographers, 5-minute film, no album",
        terms: "25% advance",
        on: "2026-09-15",
      },
    ],
    notes: "Ananya prefers Frames by Arun's candid style. Rohan wants the drone shots.",
  },
  {
    id: "makeup",
    category: "Makeup & hair",
    name: "Glam by Neha",
    stage: "enquired",
    phone: "919745088990",
    categoryId: "attire",
    quotes: [],
    notes: "Asked about a Saturday trial and Friday availability for the haldi",
  },
  {
    id: "invitations",
    category: "Invitations",
    name: "Kochi Print House",
    stage: "quoted",
    categoryId: "invitations",
    quotes: [
      { id: "inv-q1", amount: 120, perGuest: true, label: "Printed card with envelope", on: "2026-09-05" },
    ],
  },
  { id: "priest", category: "Priest (Vadhyar)", name: "", stage: "needed", quotes: [], lang: "ml" },
  { id: "dj", category: "Reception DJ", name: "", stage: "needed", categoryId: "entertainment", quotes: [] },
  {
    id: "transport",
    category: "Guest transport",
    name: "",
    stage: "needed",
    categoryId: "transport",
    quotes: [],
  },
  { id: "mehendi-artist", category: "Mehendi artist", name: "", stage: "needed", quotes: [] },
];

export const WEDDING_PAYMENT_LINKS: Record<string, { categoryId: string; vendorId?: string; by?: string }> = {
  p1: { categoryId: "venue", vendorId: "venue", by: "Ananya's family" },
  p2: { categoryId: "catering", vendorId: "catering", by: "Ananya's family" },
  p3: { categoryId: "decor", vendorId: "decor", by: "Rohan's family" },
  p4: { categoryId: "venue", vendorId: "venue" },
  p5: { categoryId: "photo", vendorId: "photography" },
  p6: { categoryId: "decor", vendorId: "decor" },
  p7: { categoryId: "catering", vendorId: "catering" },
};

export const weddingRecords: PlanRecords = {
  households: households(),
  tables: Array.from({ length: 28 }, (_, i) => ({
    id: `t${i + 1}`,
    fnId: "reception",
    name: i < 2 ? (["Family table", "Elders' table"][i] ?? `Table ${i + 1}`) : `Table ${i + 1}`,
    seats: 10,
  })),
  rooms: [
    {
      id: "crowne",
      hotel: "Crowne Plaza, Maradu",
      rooms: 12,
      nights: "Thu–Mon",
      rate: 6500,
      note: "Wedding rate held till 1 March",
    },
    { id: "homestay", hotel: "Marine Drive homestays", rooms: 4, nights: "Fri–Mon", rate: 2800 },
  ],
  vendorList: weddingVendors,
  gifts: [
    { id: "g1", from: "Valiachan & Ammachi", amount: 25001, fnId: "engagement", thanked: true },
    {
      id: "g2",
      from: "Iyer family, Coimbatore",
      item: "Silver kumkum set",
      fnId: "engagement",
      thanked: false,
    },
    { id: "g3", from: "Ananya's office friends", amount: 15000, fnId: "engagement", thanked: false },
  ],
  runsheet: [
    {
      id: "rm1",
      fnId: "mehendi",
      time: "17:00",
      title: "Mehendi artists arrive; seating on the verandah",
      owner: "Priya",
    },
    { id: "rm2", fnId: "mehendi", time: "18:00", title: "Bride's mehendi begins", owner: "Priya" },
    { id: "rm3", fnId: "mehendi", time: "19:30", title: "Songs and dance by the cousins", owner: "Meera" },
    { id: "rm4", fnId: "mehendi", time: "20:30", title: "Dinner", owner: "Priya" },
    {
      id: "rh1",
      fnId: "haldi",
      time: "09:30",
      title: "Turmeric paste, marigolds and the low stools ready",
      owner: "Priya",
    },
    { id: "rh2", fnId: "haldi", time: "10:00", title: "Haldi for the bride", owner: "Lakshmi aunty" },
    { id: "rh3", fnId: "haldi", time: "11:30", title: "Bath and change; lunch for family", owner: "Suresh" },
    {
      id: "r1",
      fnId: "ceremony",
      time: "06:30",
      title: "Venue opens: décor and caterer set up",
      owner: "Suresh",
      phone: "914842700100",
    },
    {
      id: "r2",
      fnId: "ceremony",
      time: "08:30",
      title: "Groom's party arrives, welcome with thalappoli",
      owner: "Priya",
    },
    {
      id: "r3",
      fnId: "ceremony",
      time: "09:45",
      title: "Bride's arrival and chenda melam procession",
      owner: "Unni",
      phone: "919961033445",
      note: "12 artists from the east gate",
    },
    {
      id: "r4",
      fnId: "ceremony",
      time: "10:15",
      title: "Kanyadanam preparations",
      owner: "Suresh",
      note: "Suresh brings the nilavilakku",
    },
    {
      id: "r5",
      fnId: "ceremony",
      time: "10:42",
      title: "Muhurtham: thali tying",
      owner: "Vadhyar",
      note: "Photographer at the mandapam by 10:30",
    },
    {
      id: "r6",
      fnId: "ceremony",
      time: "11:15",
      title: "Sadhya, first sitting",
      owner: "Mohanan",
      phone: "914842355500",
      note: "140 leaves",
    },
    { id: "r7", fnId: "ceremony", time: "12:15", title: "Sadhya, second sitting", owner: "Mohanan" },
    { id: "r8", fnId: "ceremony", time: "13:30", title: "Family photos at the lawn", owner: "Photographer" },
    { id: "r9", fnId: "reception", time: "18:30", title: "Lawn lights on, DJ sound check", owner: "Suresh" },
    { id: "r10", fnId: "reception", time: "19:00", title: "Guests arrive, welcome drinks", owner: "Priya" },
    { id: "r11", fnId: "reception", time: "19:45", title: "Couple's entry", owner: "DJ" },
    { id: "r12", fnId: "reception", time: "20:15", title: "Dinner opens", owner: "Venue team" },
    {
      id: "r13",
      fnId: "reception",
      time: "22:30",
      title: "Last song; buses leave from the main gate",
      owner: "Rohan",
    },
  ],
  checklist: [
    { id: "c1", fnId: "ceremony", label: "Thali and chain", owner: "Ammachi", done: false },
    { id: "c2", fnId: "ceremony", label: "Rings", owner: "Rohan", done: false },
    {
      id: "c3",
      fnId: "ceremony",
      label: "Lamp oil and wicks for the nilavilakku",
      owner: "Suresh",
      done: false,
    },
    { id: "c4", fnId: "ceremony", label: "Dakshina envelopes", owner: "Suresh", done: false },
    { id: "c5", fnId: "ceremony", label: "Kasavu sets for the elders", owner: "Priya", done: false },
    { id: "c6", fnId: "reception", label: "Cake knife and the guest book", owner: "Priya", done: false },
  ],
  memory: [
    { id: "m1", text: "No alcohol at any function" },
    { id: "m2", text: "Ammachi uses a wheelchair: ground floor and ramps only" },
    { id: "m3", text: "Keep the mandapam décor exactly as quoted" },
  ],
  ideas: [
    {
      id: "i1",
      title: "Thalappoli welcome at the entrance",
      cost: 15000,
      effort: "low",
      categoryId: "entertainment",
      status: "idea",
    },
    {
      id: "i2",
      title: "Banana-fibre favour boxes with a nendran chip pack",
      cost: 22000,
      effort: "medium",
      categoryId: "gifts",
      status: "idea",
    },
    {
      id: "i3",
      title: "Live payasam counter at the mehendi",
      cost: 18000,
      effort: "low",
      categoryId: "catering",
      status: "planned",
    },
  ],
  site: {
    published: false,
    lang: "ml",
    story:
      "Ananya and Rohan met at a Kathakali workshop in Fort Kochi and have argued about the best payasam ever since. Join us for four days of family, music and sadhya.",
    storyLocal:
      "ഫോർട്ട് കൊച്ചിയിലെ ഒരു കഥകളി ശില്പശാലയിൽ കണ്ടുമുട്ടിയ അനന്യയും രോഹനും വിവാഹിതരാകുന്നു. കുടുംബത്തോടും സംഗീതത്തോടും സദ്യയോടും കൂടിയ നാല് ദിവസങ്ങൾക്ക് ഞങ്ങളോടൊപ്പം ചേരൂ.",
    faqs: [
      { q: "Is there parking?", a: "Yes, at Kayal Heritage Centre for 120 cars. Valets from 9 am." },
      {
        q: "What should I wear?",
        a: "Kerala traditional for the muhurtham; anything festive for the reception.",
      },
      { q: "Can I bring children?", a: "Of course. There's a kids' corner at the reception." },
    ],
  },
};
