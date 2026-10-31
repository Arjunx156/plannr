import type { Swatch } from "../../data/baseTypes";
/** The landing page's words and examples, kept apart from its layout. */

/** A link in the landing page's header. */
export interface NavLink {
  href: string;
  label: string;
}

/** One budget line in the hero's sample draft; `bar` sizes it to its share of the largest, and colours it. */
export interface DraftBar {
  name: string;
  amount: string;
  bar: string;
}

/** A kind of event Plannr plans, as the landing page introduces it. */
export interface Occasion {
  type: string;
  name: string;
  body: string;
  span: string;
  bar: string;
  ink: string;
  dashed?: boolean | undefined;
}

/** A titled paragraph: a step, a feature or an example on the landing page. */
export interface Blurb {
  title: string;
  body: string;
  swatch?: Swatch | undefined;
}

/** A sample prompt and the start of the plan Plannr drafts from it. */
export interface Sample {
  tab: string;
  prompt: string;
  asked: string;
  tasks: { title: string; when: string; urgent?: boolean | undefined }[];
  vendors: string[];
  why: string;
}

/** The landing page's header links. */
export const NAV: NavLink[] = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#occasions", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/** The sentence the hero types out as an example. */
export const EXAMPLE = "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December";

/** The sample budget in the hero's draft card. */
export const DRAFT_BARS: DraftBar[] = [
  { name: "Catering", amount: "₹4,50,000", bar: "w-full bg-maroon" },
  { name: "Venue", amount: "₹3,20,000", bar: "w-[71%] bg-marigold" },
  { name: "Décor", amount: "₹2,40,000", bar: "w-[53%] bg-leaf" },
  { name: "Attire", amount: "₹2,20,000", bar: "w-[49%] bg-peacock" },
  { name: "Photography", amount: "₹1,80,000", bar: "w-[40%] bg-rust" },
];

/** The kinds of event Plannr plans. */
export const OCCASIONS: Occasion[] = [
  {
    type: "wedding",
    name: "Wedding",
    body: "Several functions over several days, each with its own budget and guests. Costs split between families.",
    span: "6–12 months of planning",
    bar: "bg-marigold",
    ink: "text-amber-ink",
  },
  {
    type: "birthday",
    name: "Birthday",
    body: "A few hours, a theme the kids will remember, allergy notes for every guest, and return gifts sorted.",
    span: "1–4 weeks of planning",
    bar: "bg-indigo",
    ink: "text-indigo-ink",
  },
  {
    type: "community",
    name: "Community event",
    body: "Pooled funds and sponsors, expense approvals, permits, stall sign-ups and volunteer shifts.",
    span: "1–3 months of planning",
    bar: "bg-leaf",
    ink: "text-leaf-ink",
  },
  {
    type: "other",
    name: "Something else",
    body: "Housewarmings, anniversaries, naming ceremonies, reunions. Describe it and Plannr works out the shape.",
    span: "Any size",
    bar: "bar-mixed",
    ink: "text-body",
    dashed: true,
  },
];

/** Three steps from a sentence to the day. */
export const STEPS: Blurb[] = [
  {
    title: "Describe your event",
    body: "Type or speak it in English, Malayalam, Hindi, Tamil and more. Plannr asks only what it still needs.",
  },
  {
    title: "Get an AI plan",
    body: "Budget, timeline, vendors, guests and ideas, tuned to your city, traditions and guest count. Each suggestion says why.",
  },
  {
    title: "Refine and execute",
    body: "Invite family and volunteers, track payments, send reminders on WhatsApp, and run the day from your phone.",
  },
];

/** What Plannr keeps track of, one card each. */
export const FEATURES: Blurb[] = [
  {
    title: "Budget",
    body: "A split by category for your city and guest count. Track every advance and balance, read receipts, and split costs between families or funds.",
    swatch: "maroon",
  },
  {
    title: "Timeline",
    body: "Tasks, payments, vendor bookings and the functions in one dated view, phase by phase, with owners and a morning reminder on your phone.",
    swatch: "marigold",
  },
  {
    title: "Vendors",
    body: "A checklist of every vendor your event needs, each with a book-by date, quotes side by side and enquiries drafted for you.",
    swatch: "leaf",
  },
  {
    title: "Guests",
    body: "Groups, plus-ones, dietary and stay needs. A no-login RSVP page whose headcount updates catering.",
    swatch: "indigo",
  },
  {
    title: "Ideas",
    body: "Themes, menus, décor and savings personalised to your month, guest count, budget and family notes. Plan one and its task and cost appear.",
    swatch: "rust",
  },
  {
    title: "AI assistant",
    body: "Ask a question or ask for a change, in your language. You see a preview of every edit before it happens.",
    swatch: "peacock",
  },
];

/** The three sample plans on the landing page. */
export type SampleId = "wedding" | "birthday" | "mela";

/** The demo event each sample opens. */
export const SAMPLE_EVENT: Record<SampleId, string> = {
  wedding: "ananya-rohan",
  birthday: "aarav-6",
  mela: "green-valley-mela",
};

/** Each sample: the sentence, what Plannr asks next, and the start of its plan. */
export const SAMPLES: Record<SampleId, Sample> = {
  wedding: {
    tab: "Kerala wedding",
    prompt: "Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh, end of April.",
    asked: "Venue status · pre-wedding functions · top three priorities",
    tasks: [
      { title: "Confirm muhurtham with astrologer", when: "Week 1" },
      { title: "Visit both shortlisted venues", when: "Week 1" },
      { title: "Book photographer", when: "Week 2", urgent: true },
      { title: "Draft guest list with both families", when: "Week 3" },
      { title: "Sadhya tasting, 2 caterers", when: "Week 4" },
    ],
    vendors: [
      "Sadhya caterer",
      "Vadhyar",
      "Chenda melam",
      "Nadaswaram",
      "Kasavu weaver",
      "Jasmine & marigold florist",
      "+5 more",
    ],
    why: "Why sadhya: “Kerala-style” and a 250-guest lunch ceremony usually means a 22–28 item vegetarian feast on banana leaf.",
  },
  birthday: {
    tab: "Space birthday",
    prompt: "Space-themed 6th birthday at home for Aarav, 30 kids and 20 adults, ₹40,000, in three weeks.",
    asked: "Allergies · entertainer or games · return gifts",
    tasks: [
      { title: "Book the planetarium show", when: "Week 1" },
      { title: "Order the rocket cake, nut-free", when: "Week 1", urgent: true },
      { title: "Send the invite to the class group", when: "Week 1" },
      { title: "Buy 30 rocket kits for return gifts", when: "Week 2" },
      { title: "Planet balloons and star backdrop", when: "Week 3" },
    ],
    vendors: ["Cake baker", "Planetarium show", "Snacks caterer", "Balloon décor", "Return gifts", "+2 more"],
    why: "Why a nut-free cake: Plannr asked about allergies, and 3 of the 30 kids have nut allergies.",
  },
  mela: {
    tab: "Diwali mela",
    prompt: "Diwali mela for our society: stalls and a cultural night, 600 people, ₹2.5 lakh, 12 volunteers.",
    asked: "Date and grounds · permits already filed · how stalls pay",
    tasks: [
      { title: "File police permission for sound", when: "Week 1", urgent: true },
      { title: "Open stall sign-ups at ₹2,500", when: "Week 1" },
      { title: "Confirm three sponsors", when: "Week 2" },
      { title: "Build the volunteer shifts", when: "Week 3" },
      { title: "Fire safety check for diya stalls", when: "Week 4" },
    ],
    vendors: [
      "Sound & lighting",
      "Stall tents",
      "Security guards",
      "Mobile toilets",
      "Pass printing",
      "+3 more",
    ],
    why: "Why police permission first: loudspeakers at a public gathering need it, and it can take a few weeks to come through.",
  },
};

/** Three days Plannr is built for. Examples of what it does, not quotes from customers. */
export const EXAMPLES: Blurb[] = [
  {
    title: "A Kerala wedding, two families",
    body: "Both families see one budget. Every advance is marked with who paid it, and the 60/40 split shows who owes whom, settled with one tap.",
    swatch: "marigold",
  },
  {
    title: "A birthday in ten days",
    body: "A run sheet for the afternoon, RSVPs with allergy notes from each family, and the return-gift order on the same list as the cake.",
    swatch: "indigo",
  },
  {
    title: "A housing society's festival",
    body: "Volunteers pick their own shifts, stallholders request a stall, the treasurer approves expenses, and residents see where the money went.",
    swatch: "leaf",
  },
];

/** Questions families ask before they start. */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "Will the AI change my plan without asking?",
    a: "No. Every change, whether you asked for it or Plannr noticed something, shows up as a preview first. Nothing in your budget, tasks or guest list moves until you or a co-planner approves it.",
  },
  {
    q: "Does it know local traditions and prices?",
    a: "For the cities it covers, yes. Vendor categories, rituals and price ranges come from your city and the traditions you describe: sadhya and chenda melam in Kochi, a mandap and baraat in Jaipur. Every suggestion says why, so you can see when it's estimating.",
  },
  {
    q: "Can my family use it in Malayalam or Hindi?",
    a: "Yes. Ask the assistant in Malayalam, Hindi, Tamil or English, typed or spoken, and it replies in kind. Guests read their invitation in their own language, and messages to vendors and guests can be drafted in it.",
  },
  {
    q: "Do guests need to download anything to RSVP?",
    a: "No. Each household gets its own link on WhatsApp and replies on a simple page with no app and no login. Their answers update the headcount for each function, and the catering count follows once you approve.",
  },
  {
    q: "Who can see our budget?",
    a: "Only the people you invite, with the role you give them. Co-planners see and edit everything. Helpers and volunteers see their own tasks, not the money.",
  },
];
