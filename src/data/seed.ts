import { addDays, dateRange, dayMonth, demoShift, longDate, monthName, shortDate, TODAY } from "../lib/dates";
import type {
  CommunityEvent,
  EmptyEvent,
  NotificationItem,
  PastEvent,
  PersonalEvent,
  PlannrEvent,
} from "./types";

/**
 * One signed-in planner, three live events in three roles: Ananya's elder sister and
 * co-planner on the wedding, Aarav's mother, and cultural secretary of Green Valley Society.
 */
export const DEMO_USER = {
  name: "Priya Menon",
  firstName: "Priya",
  initials: "PM",
  plan: "Pro plan",
  city: "Kochi, Kerala",
  language: "English",
};

const wedding: PersonalEvent = {
  id: "ananya-rohan",
  kind: "wedding",
  layout: "personal",
  name: "Ananya & Rohan's wedding",
  role: "CO-PLANNER",
  hue: "marigold",
  eyebrow: "Wedding · Kochi · {range:2027-04-22:2027-04-25}",
  navMeta: "Wedding · Kochi · {range:2027-04-22:2027-04-25}",
  listMeta: "Kochi · 4 functions · {range:2027-04-22:2027-04-25} · 268 guests",
  date: "2027-04-25",
  guests: 268,
  countdown: {
    label: "Countdown to the muhurtham",
    line: "{long:2027-04-25} · 10:42 am (tentative) · Kayal Heritage Centre, Maradu",
    theme: "maroon",
  },
  functions: [
    {
      id: "mehendi",
      label: "Mehendi",
      date: "2027-04-22",
      time: "6:00 pm",
      place: "Ananya's home, Tripunithura",
    },
    {
      id: "haldi",
      label: "Haldi",
      date: "2027-04-24",
      time: "10:00 am",
      place: "Ananya's home, Tripunithura",
    },
    {
      id: "ceremony",
      label: "Ceremony",
      date: "2027-04-25",
      part: "AM",
      time: "10:42 am (tentative)",
      place: "Kayal Heritage Centre, Maradu",
    },
    {
      id: "reception",
      label: "Reception",
      date: "2027-04-25",
      part: "PM",
      time: "7:00 pm",
      place: "Kayal Heritage Centre, Maradu",
    },
  ],
  people: [
    { initials: "AN", bg: "#D9962B", fg: "#1F1B16", name: "Ananya" },
    { initials: "RO", bg: "#6E1F2E", fg: "#FFFFFF", name: "Rohan" },
    { initials: "PM", bg: "#1F5F6B", fg: "#FFFFFF", name: "Priya Menon" },
  ],
  morePeople: 2,
  pace: "On pace: 34% expected at 7 months out",
  budgetScore: 0.62,
  budgetNote: "mostly catering",
  budget: {
    total: 1800000,
    committed: 432000,
    source:
      "Split suggested by Plannr for a 250-guest Kerala Hindu wedding in Kochi with sadhya and an evening reception. You've edited 3 categories since.",
    categories: [
      {
        id: "catering",
        name: "Catering",
        planned: 450000,
        spent: 100000,
        projected: 504000,
        status: "12% over",
        tone: "warn",
        items: [
          {
            id: "sadhya",
            name: "Wedding sadhya, 26 items · 250 × ₹2,016",
            vendor: "Sree Annapoorna",
            amount: 504000,
            status: "advance",
            due: "2027-04-10",
          },
          {
            id: "buffet",
            name: "Reception buffet",
            vendor: "In venue package",
            amount: 0,
            status: "included",
          },
          {
            id: "payasam",
            name: "Payasam counter, mehendi night",
            vendor: "Not chosen",
            amount: 18000,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "attire",
        name: "Attire & jewellery",
        planned: 220000,
        spent: 185000,
        projected: 230000,
        status: "Trending ₹10,000 over",
        tone: "warn",
        items: [
          {
            id: "saree",
            name: "Bridal kasavu saree",
            vendor: "Balaramapuram weavers",
            amount: 85000,
            status: "paid",
          },
          {
            id: "jewels",
            name: "Temple jewellery rental",
            vendor: "Sree Lakshmi Jewels",
            amount: 60000,
            status: "paid",
          },
          {
            id: "mundu",
            name: "Groom's mundu & jubba",
            vendor: "Kasavu Kada, MG Road",
            amount: 40000,
            status: "paid",
          },
          {
            id: "reception-outfits",
            name: "Reception outfits",
            vendor: "Not chosen",
            amount: 45000,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "venue",
        name: "Venue",
        planned: 320000,
        spent: 200000,
        status: "Balance due {dm:2026-10-05}",
        tone: "due",
        items: [
          {
            id: "kayal",
            name: "Hall and lawns, 2 days",
            vendor: "Kayal Heritage Centre",
            amount: 320000,
            status: "advance",
            due: "2026-10-05",
          },
        ],
      },
      {
        id: "photo",
        name: "Photography & video",
        planned: 180000,
        spent: 0,
        status: "Not booked",
        tone: "due",
        items: [
          {
            id: "photo-pkg",
            name: "Photo + video, 4 functions",
            vendor: "3 shortlisted",
            amount: 180000,
            estimate: true,
            status: "unpaid",
            due: "2026-10-11",
          },
        ],
      },
      {
        id: "decor",
        name: "Décor",
        planned: 240000,
        spent: 60000,
        status: "On plan",
        tone: "ok",
        items: [
          {
            id: "mandapam",
            name: "Mandapam & ceremony stage",
            vendor: "Mangalya Décor",
            amount: 85000,
            status: "advance",
          },
          {
            id: "backdrop",
            name: "Reception stage backdrop",
            vendor: "Mangalya Décor",
            amount: 65000,
            status: "unpaid",
          },
          { id: "arch", name: "Entrance arch", vendor: "Mangalya Décor", amount: 30000, status: "unpaid" },
          {
            id: "centrepieces",
            name: "Table centrepieces",
            vendor: "Mangalya Décor",
            amount: 40000,
            status: "unpaid",
          },
          {
            id: "haldi-setup",
            name: "Haldi & mehendi setup",
            vendor: "Mangalya Décor",
            amount: 20000,
            status: "unpaid",
          },
        ],
      },
      {
        id: "transport",
        name: "Transport & stay",
        planned: 95000,
        spent: 60000,
        status: "On plan",
        tone: "ok",
        items: [
          {
            id: "rooms",
            name: "Rooms for the Dubai cousins",
            vendor: "Marine Drive homestays",
            amount: 60000,
            status: "paid",
          },
          {
            id: "bus",
            name: "Guest bus, 2 days",
            vendor: "Not chosen",
            amount: 35000,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "entertainment",
        name: "Entertainment",
        planned: 90000,
        spent: 25000,
        status: "On plan",
        tone: "ok",
        items: [
          {
            id: "chenda",
            name: "Chenda melam, 12 artists",
            vendor: "Sree Durga Chenda Sangham",
            amount: 25000,
            status: "paid",
          },
          {
            id: "nadaswaram",
            name: "Nadaswaram",
            vendor: "Not chosen",
            amount: 30000,
            estimate: true,
            status: "unpaid",
          },
          {
            id: "dj",
            name: "Reception DJ",
            vendor: "Not chosen",
            amount: 35000,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "gifts",
        name: "Gifts & favours",
        planned: 70000,
        spent: 20000,
        status: "On plan",
        tone: "ok",
        items: [
          {
            id: "diyas",
            name: "Brass diya sets, 250",
            vendor: "Nilavilakku Crafts, Mannar",
            amount: 60000,
            status: "advance",
          },
          {
            id: "tips",
            name: "Gifts & tips",
            vendor: "Family",
            amount: 10000,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "invitations",
        name: "Invitations",
        planned: 45000,
        spent: 15000,
        status: "Printer quote pending",
        tone: "idle",
        items: [
          { id: "std", name: "Save-the-date design", vendor: "Studio Kolam", amount: 15000, status: "paid" },
          {
            id: "cards",
            name: "Printed invitations, 250 cards",
            vendor: "Quote pending",
            amount: 30000,
            estimate: true,
            status: "quote",
          },
        ],
      },
      {
        id: "contingency",
        name: "Contingency",
        planned: 90000,
        spent: 20000,
        status: "Used for engagement",
        tone: "idle",
        items: [
          {
            id: "engagement",
            name: "Engagement dinner top-up",
            vendor: "Family",
            amount: 20000,
            status: "paid",
          },
        ],
      },
    ],
    payments: [
      {
        id: "p1",
        date: "2026-08-12",
        label: "Venue advance · Kayal Heritage Centre",
        amount: 200000,
        paid: true,
      },
      {
        id: "p2",
        date: "2026-09-02",
        label: "Catering advance · Sree Annapoorna",
        amount: 100000,
        paid: true,
      },
      { id: "p3", date: "2026-09-21", label: "Décor advance · Mangalya Décor", amount: 60000, paid: true },
      { id: "p4", date: "2026-10-05", label: "Venue balance · Suresh", amount: 120000, paid: false },
      {
        id: "p5",
        date: "2026-10-11",
        label: "Photographer advance",
        amount: 50000,
        paid: false,
        estimate: true,
      },
      { id: "p6", date: "2026-11-15", label: "Décor 2nd instalment", amount: 90000, paid: false },
      { id: "p7", date: "2027-04-10", label: "Catering balance", amount: 404000, paid: false },
    ],
    savings: [
      {
        id: "jasmine",
        title: "Fresh jasmine & marigold strings for the mandapam",
        amount: 38000,
        why: "Jasmine is in season for the wedding; local strings run ~₹420/kg vs imported orchids.",
        category: "decor",
      },
      {
        id: "sadhya-22",
        title: "Trim sadhya from 26 to 22 items",
        amount: 30000,
        why: "Sree Annapoorna's 22-item menu is ₹1,896 a leaf; both payasams stay.",
        category: "catering",
      },
      {
        id: "photo-combo",
        title: "Book photo + video as one package",
        amount: 25000,
        why: "2 of your 3 shortlisted studios discount combined bookings.",
        category: "photo",
      },
    ],
    split: {
      label: "Agreed 60 / 40",
      sides: [
        { name: "Ananya's family", share: 0.6, paid: 460000, color: "#D9962B" },
        { name: "Rohan's family", share: 0.4, paid: 225000, color: "#6E1F2E" },
      ],
    },
    byFunction: [
      { fn: "Mehendi", planned: 110000, spent: 15000 },
      { fn: "Haldi", planned: 80000, spent: 10000 },
      { fn: "Ceremony", planned: 940000, spent: 410000 },
      { fn: "Reception", planned: 480000, spent: 130000 },
      { fn: "Shared: attire, invitations, contingency", planned: 190000, spent: 120000 },
    ],
    whatIf: {
      baseGuests: 250,
      min: 100,
      max: 400,
      rates: [
        { category: "Catering", perGuest: 2016 },
        { category: "Gifts & favours", perGuest: 140 },
        { category: "Invitations", perGuest: 100 },
      ],
    },
  },
  tasks: {
    total: 71,
    doneBefore: 22,
    list: [
      {
        id: "w1",
        title: "Finalise guest list with both families",
        who: "Ananya, Rohan",
        due: "2026-09-24",
        done: false,
        note: "Blocks “Print invitations”",
      },
      {
        id: "w2",
        title: "Confirm muhurtham with family astrologer",
        who: "Suresh",
        due: "2026-09-26",
        done: false,
        fn: "ceremony",
        note: "Ceremony",
      },
      {
        id: "w3",
        title: "Pay venue balance ₹1,20,000",
        who: "Suresh",
        due: "2026-10-05",
        done: false,
        note: "Kayal Heritage Centre",
      },
      {
        id: "w4",
        title: "Book photographer",
        who: "You",
        due: "2026-10-11",
        done: false,
        note: "3 shortlisted · ₹1,80,000 planned",
      },
      {
        id: "w5",
        title: "Sadhya tasting at Sree Annapoorna",
        who: "Rohan",
        due: "2026-10-14",
        done: false,
        fn: "ceremony",
        note: "Catering",
      },
      {
        id: "w6",
        title: "Shortlist mehendi artists",
        who: "You",
        due: "2026-10-20",
        done: false,
        fn: "mehendi",
        note: "Mehendi",
      },
      {
        id: "w7",
        title: "Book the reception DJ",
        who: "Rohan",
        due: "2026-11-02",
        done: false,
        fn: "reception",
        note: "Reception",
      },
      {
        id: "w8",
        title: "Print invitations",
        who: "You",
        due: "2027-01-15",
        done: false,
        note: "Waiting on the guest list",
      },
      {
        id: "w9",
        title: "Haldi caterer headcount",
        who: "You",
        due: "2027-04-10",
        done: false,
        fn: "haldi",
        note: "Haldi",
      },
      {
        id: "w10",
        title: "Collect turmeric & marigolds",
        who: "You",
        due: "2027-04-23",
        done: false,
        fn: "haldi",
        note: "Haldi",
      },
    ],
  },
  vendors: {
    booked: ["Venue", "Décor", "Chenda melam"],
    talking: ["Catering", "Photography", "Makeup & hair", "Invitations"],
    needed: ["Priest (Vadhyar)", "Reception DJ", "Guest transport", "Mehendi artist"],
    note: "Photographer is time-critical",
  },
  rsvp: { total: 268, invited: 180, confirmed: 96, declined: 8, pending: 76, notSent: 88 },
  notices: [
    {
      id: "photographer-window",
      tone: "warn",
      label: "Booking window closing",
      text: "Photographers in Kochi book out 6 months ahead. You have 2 weeks left to book.",
      why: "Why: 11 of 14 Ernakulam photographers you'd consider are already 60% booked for your dates.",
      primary: { label: "Compare 3 shortlisted", action: "compare-photographers" },
      secondary: { label: "Remind me Fri", action: "remind" },
      status: "open",
    },
    {
      id: "catering-over",
      tone: "warn",
      label: "Over plan",
      text: "Catering is 12% over plan: ₹5,04,000 quoted against ₹4,50,000.",
      why: "Why: Sree Annapoorna quoted ₹2,016 a leaf for a 26-item sadhya for 250 guests.",
      primary: { label: "See 3 ways to save", action: "open-savings" },
      secondary: { label: "Accept overrun", action: "accept-overrun" },
      status: "open",
    },
    {
      id: "guests-grew",
      tone: "ai",
      label: "Waiting for your approval",
      text: "The guest list grew from 250 to 268. Update the connected parts of the plan?",
      lines: ["Catering +₹36,288 (18 leaves)", "Invitations +18 cards · Seating +2 tables"],
      primary: { label: "Review 3 changes", action: "review-guest-changes" },
      secondary: { label: "Not now", action: "dismiss" },
      status: "open",
    },
  ],
  assistant: {
    intro: "",
    chips: [
      "What's left to book in {month:2026-10-15}?",
      "Summarise spend for Rohan's parents",
      "Why is readiness 38%?",
    ],
    thread: [
      { id: "m1", role: "user", text: "How much should we tip the chenda melam troupe?" },
      {
        id: "m2",
        role: "ai",
        text: "For a 12-member troupe playing about 45 minutes at the procession, families in Kochi usually give ₹500–₹800 per performer. Around ₹8,000 total, handed to the troupe leader afterwards.",
        source: "Based on your booking with Sree Durga Chenda Sangham (12 artists).",
        action: { label: "Add ₹8,000 to Gifts & tips", id: "add-tip" },
      },
      { id: "m3", role: "user", text: "Move the haldi to Friday and update the tasks" },
      {
        id: "m4",
        role: "ai",
        text: "Here's what would change. Nothing is applied until you confirm.",
        preview: {
          id: "pv-haldi",
          title: "Preview · 4 changes",
          tag: "Haldi",
          change: "move-haldi",
          status: "pending",
          rows: [
            { title: "Haldi date", from: "{short:2027-04-24}", to: "{short:2027-04-23}, 5:00 pm" },
            {
              title: "2 tasks move a day earlier",
              detail: "Haldi caterer headcount · Collect turmeric & marigolds (Priya)",
            },
            {
              title: "Makeup artist needs to confirm",
              detail: "Glam by Neha quoted for Saturday. I'll draft a WhatsApp asking about Friday.",
            },
            {
              title: "Heads-up",
              detail: "Mehendi is Thursday night, so the bride has back-to-back evenings.",
              headsUp: true,
            },
          ],
        },
      },
    ],
  },
  home: {
    budgetNote: { text: "Projected ₹64,000 over", tone: "warn" },
    readinessNote: { text: "2 tasks overdue", tone: "warn" },
  },
};

const birthday: PersonalEvent = {
  id: "aarav-6",
  kind: "birthday",
  layout: "personal",
  name: "Aarav's 6th birthday",
  role: "OWNER",
  hue: "indigo",
  eyebrow: "Aarav turns 6 · Space theme · {long:2026-10-17}",
  navMeta: "Birthday · Home, Kakkanad · {short:2026-10-17}",
  listMeta: "Space theme · at home, Kakkanad · {short:2026-10-17} · 30 kids, 20 adults",
  date: "2026-10-17",
  guests: 50,
  countdown: {
    label: "Countdown to the party",
    line: "{long:2026-10-17} · 4–7 pm · at home, Kakkanad",
    theme: "indigo",
  },
  functions: [],
  people: [
    { initials: "PM", bg: "#1F5F6B", fg: "#FFFFFF", name: "Priya Menon" },
    { initials: "VM", bg: "#5A6FB8", fg: "#FFFFFF", name: "Vivek Menon" },
  ],
  morePeople: 0,
  pace: "On pace: 55% expected three weeks out",
  budgetScore: 0.7,
  budgetNote: "on track",
  budget: {
    total: 40000,
    committed: 9000,
    source: "Split suggested by Plannr for a space-themed party at home for 30 kids and 20 adults.",
    categories: [
      {
        id: "food",
        name: "Food & snacks",
        planned: 10000,
        spent: 0,
        status: "Not spent",
        tone: "idle",
        note: "Mini dosas, juice, popcorn for 50",
        items: [
          {
            id: "dosa",
            name: "Mini dosa counter",
            vendor: "Not chosen",
            amount: 6000,
            estimate: true,
            status: "unpaid",
          },
          {
            id: "juice",
            name: "Juice and popcorn",
            vendor: "Not chosen",
            amount: 4000,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "decor",
        name: "Décor",
        planned: 9000,
        spent: 6200,
        status: "On plan",
        tone: "ok",
        note: "Planet balloons, star backdrop",
        items: [
          {
            id: "balloons",
            name: "Planet balloons",
            vendor: "Party Cart, Kakkanad",
            amount: 3200,
            status: "paid",
          },
          {
            id: "backdrop",
            name: "Star backdrop",
            vendor: "Party Cart, Kakkanad",
            amount: 3000,
            status: "paid",
          },
          {
            id: "arch2",
            name: "Second balloon arch",
            vendor: "Not chosen",
            amount: 1800,
            estimate: true,
            status: "unpaid",
          },
        ],
      },
      {
        id: "entertainer",
        name: "Entertainer",
        planned: 8000,
        spent: 3000,
        status: "Advance paid",
        tone: "due",
        note: "Portable planetarium show, 45 min",
        items: [
          {
            id: "show",
            name: "Planetarium show, 45 min",
            vendor: "Starlab Kids",
            amount: 8000,
            status: "advance",
            due: "2026-10-17",
          },
        ],
      },
      {
        id: "cake",
        name: "Cake",
        planned: 4500,
        spent: 500,
        status: "Advance paid",
        tone: "due",
        note: "Rocket cake, 2 kg, nut-free · Bake Street",
        items: [
          {
            id: "rocket",
            name: "Rocket cake, 2 kg, nut-free",
            vendor: "Bake Street",
            amount: 4500,
            status: "advance",
            due: "2026-10-13",
          },
        ],
      },
      {
        id: "gifts",
        name: "Return gifts",
        planned: 4500,
        spent: 4500,
        status: "Paid",
        tone: "ok",
        note: "30 × build-your-own rocket kits",
        items: [
          {
            id: "kits",
            name: "Rocket kits, 30",
            vendor: "Toy Planet, Edappally",
            amount: 4500,
            status: "paid",
          },
        ],
      },
      {
        id: "contingency",
        name: "Contingency",
        planned: 4000,
        spent: 0,
        status: "Not spent",
        tone: "idle",
        items: [],
      },
    ],
    payments: [
      { id: "bp1", date: "2026-09-12", label: "Return gifts · Toy Planet", amount: 4500, paid: true },
      {
        id: "bp2",
        date: "2026-09-18",
        label: "Planetarium advance · Starlab Kids",
        amount: 3000,
        paid: true,
      },
      { id: "bp3", date: "2026-09-20", label: "Cake advance · Bake Street", amount: 500, paid: true },
      { id: "bp4", date: "2026-10-13", label: "Cake balance", amount: 4000, paid: false },
      { id: "bp5", date: "2026-10-17", label: "Space show balance", amount: 5000, paid: false },
    ],
    savings: [],
    dueSoon: [
      { label: "Cake balance · {short:2026-10-13}", amount: 4000 },
      { label: "Space show balance · on the day", amount: 5000 },
    ],
  },
  tasks: {
    total: 18,
    doneBefore: 12,
    list: [
      {
        id: "b1",
        title: "Order the rocket cake from Bake Street",
        who: "You",
        due: "2026-09-29",
        done: false,
        note: "Cake · nut-free",
      },
      {
        id: "b2",
        title: "Send WhatsApp invite to Aarav's class group",
        who: "You",
        due: "2026-09-30",
        done: false,
        note: "Guests",
      },
      {
        id: "b3",
        title: "Confirm planetarium show timing",
        who: "Vivek",
        due: "2026-10-03",
        done: false,
        note: "Starlab Kids",
      },
      {
        id: "b4",
        title: "Collect allergy notes from parents",
        who: "You",
        due: "2026-10-05",
        done: false,
        note: "3 nut allergies so far",
      },
      {
        id: "b5",
        title: "Pay cake balance ₹4,000",
        who: "You",
        due: "2026-10-13",
        done: false,
        note: "Bake Street",
      },
      {
        id: "b6",
        title: "Set up the rocket photo corner",
        who: "Vivek",
        due: "2026-10-16",
        done: false,
        note: "Décor",
      },
    ],
  },
  vendors: { booked: ["Planetarium show", "Return gifts"], talking: ["Cake"], needed: ["Snacks caterer"] },
  rsvp: { total: 50, invited: 50, confirmed: 29, declined: 3, pending: 18, notSent: 0 },
  notices: [
    {
      id: "cake-order",
      tone: "warn",
      label: "Cake not ordered",
      text: "Bake Street needs 10 days for a 2 kg shaped cake. Order by {short:2026-10-07} to be safe.",
      why: "Why: the rocket has a fondant topper that is made separately.",
      primary: { label: "Mark as ordered", action: "order-cake" },
      secondary: { label: "Remind me Fri", action: "remind" },
      status: "open",
    },
    {
      id: "stars",
      tone: "ai",
      label: "Suggestion",
      text: "Glow-in-the-dark stars on the living-room ceiling instead of a second balloon arch. Saves ₹1,800.",
      why: "Why: the party runs 4–7 pm, so the room is dim enough by the cake cutting.",
      primary: { label: "Add to plan", action: "add-stars" },
      secondary: { label: "No thanks", action: "dismiss" },
      status: "open",
    },
    {
      id: "allergies",
      tone: "info",
      label: "From the guest list",
      text: "3 kids have nut allergies. Bake Street charges ₹400 for a nut-free bake; it's already in the cake line.",
      primary: { label: "Got it", action: "acknowledge" },
      status: "open",
    },
  ],
  assistant: {
    intro: "",
    chips: ["What's left before the party?", "Snack ideas for 30 kids", "Who has allergies?"],
    thread: [],
  },
  home: {
    budgetNote: { text: "On track", tone: "ok" },
    readinessNote: { text: "Cake not ordered yet", tone: "idle" },
  },
};

const mela: CommunityEvent = {
  id: "green-valley-mela",
  kind: "community",
  layout: "community",
  name: "Green Valley Society Mela",
  role: "ORGANISER",
  hue: "leaf",
  eyebrow: "Community event · Green Valley Society, Kakkanad · {long:2026-11-07}",
  navMeta: "Community · Society grounds · {short:2026-11-07}",
  listMeta: "Stalls + cultural night · {short:2026-11-07} · 600 attendees · 12 volunteers",
  date: "2026-11-07",
  countdown: { label: "Mela day in", line: "Gates open 4 pm · stalls, rangoli and a cultural night" },
  segments: [
    { id: "all", label: "Whole event", line: "Gates open 4 pm · stalls, rangoli and a cultural night" },
    { id: "stalls", label: "Stalls · 4–10 pm", line: "Stall setup from 2 pm · 18 of 30 booked" },
    {
      id: "rangoli",
      label: "Rangoli contest · 4 pm",
      line: "Judging at 6 pm · prizes from the society fund",
    },
    { id: "night", label: "Cultural night · 7–10 pm", line: "Sound check 5:30 pm · ends 10 pm sharp" },
  ],
  funds: {
    budget: 250000,
    spent: 96500,
    sources: [
      { label: "Society fund", expected: 150000, received: 150000, note: "received", tone: "ok" },
      { label: "Sponsors · 2 of 3 paid", expected: 70000, received: 40000, note: "₹30,000 due", tone: "due" },
      { label: "Stall fees · 18 × ₹2,500", expected: 45000, received: 30000, note: "6 pending", tone: "due" },
    ],
    approvals: [
      {
        id: "a1",
        label: "Sound & lighting advance · Lumen Events",
        by: "Arjun",
        amount: 25000,
        status: "pending",
      },
      { id: "a2", label: "Rangoli colours and prizes", by: "Rekha", amount: 6000, status: "pending" },
    ],
  },
  tasks: {
    total: 54,
    doneBefore: 26,
    list: [
      {
        id: "m1",
        title: "Collect stall fees from 6 pending stalls",
        who: "Farhan (volunteer)",
        due: "2026-09-26",
        done: false,
      },
      {
        id: "m2",
        title: "File police permission for loudspeaker use",
        who: "You",
        due: "2026-10-01",
        done: false,
      },
      { id: "m3", title: "Confirm the third sponsor's payment", who: "You", due: "2026-10-02", done: false },
    ],
  },
  permits: [
    { label: "Police permission (sound)", status: "Not filed", tone: "warn", permit: true },
    { label: "Fire safety check for diya stalls", status: "In progress", tone: "due", permit: true },
    { label: "Corporation stall licence", status: "Approved", tone: "ok", permit: true },
    { label: "Sound & lighting · Lumen Events", status: "Advance awaiting approval", tone: "due" },
    { label: "Security · 6 guards", status: "Booked", tone: "ok" },
    { label: "Sanitation · 4 mobile toilets", status: "Booked", tone: "ok" },
  ],
  passes: { issued: 412, capacity: 600 },
  stalls: { booked: 18, total: 30 },
  shifts: {
    slots: ["2–5 pm · setup", "5–8 pm · stalls", "8–11 pm · show & clean"],
    roles: [
      {
        role: "Entry & passes",
        slots: [
          { need: 2, names: ["Farhan", "Divya"] },
          { need: 2, names: ["Joseph", "Anu"] },
          { need: 2, names: ["Sanjay"] },
        ],
      },
      {
        role: "Stall coordination",
        slots: [
          { need: 2, names: ["Rekha", "Vinod"] },
          { need: 2, names: ["Rekha", "Sanjay"] },
          { need: 1, names: ["Vinod"] },
        ],
      },
      {
        role: "Stage & sound",
        slots: [
          { need: 0, names: [] },
          { need: 1, names: ["Arjun"] },
          { need: 2, names: ["Arjun", "Meera"] },
        ],
      },
      {
        role: "Food safety",
        slots: [
          { need: 0, names: [] },
          { need: 2, names: [] },
          { need: 1, names: ["Thomas"] },
        ],
      },
      {
        role: "Parking",
        slots: [
          { need: 0, names: [] },
          { need: 2, names: ["Ravi", "Divya"] },
          { need: 1, names: ["Ravi"] },
        ],
      },
      {
        role: "First aid",
        slots: [
          { need: 0, names: [] },
          { need: 1, names: ["Dr. Leela"] },
          { need: 1, names: ["Dr. Leela"] },
        ],
      },
      {
        role: "Clean-up",
        slots: [
          { need: 0, names: [] },
          { need: 0, names: [] },
          { need: 2, names: [] },
        ],
      },
    ],
  },
  volunteers: [
    "Farhan",
    "Divya",
    "Joseph",
    "Anu",
    "Sanjay",
    "Rekha",
    "Vinod",
    "Arjun",
    "Meera",
    "Thomas",
    "Ravi",
    "Dr. Leela",
  ],
  notices: [
    {
      id: "police",
      tone: "warn",
      label: "Permit",
      text: "Police permission for amplified sound takes about 3 weeks. File by {short:2026-10-17}.",
      why: "Why: cultural night runs till 10 pm with a 2 kW sound system on open ground.",
      primary: { label: "Draft the application", action: "draft-permit" },
      status: "open",
    },
    {
      id: "areca",
      tone: "ai",
      label: "Suggestion",
      text: "Ask food stalls to serve on areca-leaf plates. Adds ₹1.20 a plate, cuts most of last year's waste.",
      why: "Why: 2023 clean-up logged 38 bags of single-use plates.",
      primary: { label: "Add to plan · 2 tasks", action: "add-areca" },
      secondary: { label: "Dismiss", action: "dismiss" },
      status: "open",
    },
  ],
  assistant: {
    intro: "",
    chips: [
      "Draft the police permission application",
      "Who's free for food safety 5–8 pm?",
      "Summarise funds for the committee",
    ],
    thread: [],
  },
  home: {
    budgetNote: { text: "2 expenses awaiting approval", tone: "idle" },
    readinessNote: { text: "Police permission not filed", tone: "warn" },
  },
};

const anniversary: EmptyEvent = {
  id: "amma-achan-35",
  kind: "other",
  layout: "empty",
  name: "Mom & Dad's 35th anniversary",
  role: "CO-PLANNER",
  hue: "maroon",
  eyebrow: "Anniversary · shared by Anil Menon",
  navMeta: "Anniversary · no plan yet",
  listMeta: "Shared by Anil Menon · no plan yet",
  date: "2026-12-20",
  sharedBy: "Anil Menon",
};

const TOKEN = /\{(long|short|dm|month|range):(\d{4}-\d{2}-\d{2})(?::(\d{4}-\d{2}-\d{2}))?\}/g;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Moves every date in the demo by `days`, and renders dates written into text from the moved dates. */
export function freshen<T>(value: T, days: number): T {
  if (typeof value === "string") {
    if (ISO.test(value)) return addDays(value, days) as T;
    return value.replace(TOKEN, (_, kind: string, a: string, b?: string) => {
      const from = addDays(a, days);
      if (kind === "range") return dateRange(from, addDays(b ?? a, days));
      if (kind === "short") return shortDate(from);
      if (kind === "dm") return dayMonth(from);
      if (kind === "month") return monthName(from);
      return longDate(from);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => freshen(v, days)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = freshen(v, days);
    return out as T;
  }
  return value;
}

/** The demo events, moved so the story starts today. */
export function seedEvents(today = TODAY): PlannrEvent[] {
  return freshen([wedding, birthday, mela, anniversary], demoShift(today));
}

export const SEED_IDS = [wedding.id, birthday.id, mela.id, anniversary.id];

/** Past events keep their real dates: they're history, and festivals happen when they happen. */
export function pastEvents(): PastEvent[] {
  return structuredClone(PAST_EVENTS);
}

export function seedNotifications(today = TODAY): NotificationItem[] {
  return freshen(NOTIFICATIONS, demoShift(today));
}

const PAST_EVENTS: PastEvent[] = [
  {
    id: "onam-26",
    name: "Onam sadhya for the family",
    kind: "other",
    date: "2026-09-05",
    summary: "₹38,000 spent · 42 guests",
  },
  {
    id: "ganesh-26",
    name: "Green Valley Ganesh Chaturthi",
    kind: "community",
    date: "2026-09-14",
    summary: "₹1.1L in funds · 9 volunteers",
  },
  {
    id: "achan-60",
    name: "Achan's 60th birthday",
    kind: "birthday",
    date: "2026-01-18",
    summary: "₹62,000 spent · 70 guests",
  },
  {
    id: "aarav-5",
    name: "Aarav's 5th birthday",
    kind: "birthday",
    date: "2025-10-18",
    summary: "Dinosaur theme · 38 guests",
  },
  {
    id: "office-onam",
    name: "Office Onam lunch",
    kind: "other",
    date: "2025-08-29",
    summary: "Draft, never planned",
    archived: true,
  },
  {
    id: "housewarming",
    name: "Housewarming, Kakkanad flat",
    kind: "other",
    date: "2025-06-08",
    summary: "₹54,000 spent · 60 guests",
    archived: true,
  },
];

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1",
    text: "Rohan added 18 guests from Dubai. 3 changes wait for your approval.",
    when: "2 hours ago",
    eventId: "ananya-rohan",
    unread: true,
  },
  {
    id: "n2",
    text: "Sree Annapoorna sent a revised sadhya quote: ₹2,016 a leaf.",
    when: "Yesterday",
    eventId: "ananya-rohan",
    unread: true,
  },
  {
    id: "n3",
    text: "Rekha submitted ₹6,000 for rangoli colours and prizes.",
    when: "Yesterday",
    eventId: "green-valley-mela",
    unread: true,
  },
  {
    id: "n4",
    text: "29 of 50 guests have replied for Aarav's party.",
    when: "Fri",
    eventId: "aarav-6",
    unread: true,
  },
  {
    id: "n5",
    text: "The venue balance of ₹1,20,000 is due {short:2026-10-05}.",
    when: "Fri",
    eventId: "ananya-rohan",
    unread: true,
  },
  {
    id: "n6",
    text: "Arjun submitted the Lumen Events advance for approval.",
    when: "Thu",
    eventId: "green-valley-mela",
    unread: true,
  },
];
