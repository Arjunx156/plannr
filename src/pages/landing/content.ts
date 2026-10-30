/** The landing page's words and examples, kept apart from its layout. */

export const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#occasions", label: "Templates" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export const EXAMPLE = "Kerala wedding in Kochi, 250 guests, ₹18 lakh, December";

export const DRAFT_BARS = [
  { name: "Catering", amount: "₹4,50,000", width: 100, color: "#6E1F2E" },
  { name: "Venue", amount: "₹3,20,000", width: 71, color: "#D9962B" },
  { name: "Décor", amount: "₹2,40,000", width: 53, color: "#3D7A4F" },
  { name: "Attire", amount: "₹2,20,000", width: 49, color: "#1F5F6B" },
  { name: "Photography", amount: "₹1,80,000", width: 40, color: "#B5452B" },
];

export const OCCASIONS = [
  {
    type: "wedding",
    name: "Wedding",
    body: "Several functions over several days, each with its own budget and guests. Costs split between families.",
    span: "6–12 months of planning",
    bar: "#D9962B",
    ink: "text-amber-ink",
  },
  {
    type: "birthday",
    name: "Birthday",
    body: "A few hours, a theme the kids will remember, allergy notes for every guest, and return gifts sorted.",
    span: "1–4 weeks of planning",
    bar: "#5A6FB8",
    ink: "text-indigo-ink",
  },
  {
    type: "community",
    name: "Community event",
    body: "Pooled funds and sponsors, expense approvals, permits, stall sign-ups and volunteer shifts.",
    span: "1–3 months of planning",
    bar: "#3D7A4F",
    ink: "text-leaf-ink",
  },
  {
    type: "other",
    name: "Something else",
    body: "Housewarmings, anniversaries, naming ceremonies, reunions. Describe it and Plannr works out the shape.",
    span: "Any size",
    bar: "repeating-linear-gradient(90deg,#D9962B 0 12px,#3D7A4F 12px 24px)",
    ink: "text-body",
    dashed: true,
  },
];

export const STEPS = [
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

export const FEATURES = [
  {
    t: "Budget",
    d: "A split by category for your city and guest count. Track every advance and balance, read receipts, and split costs between families or funds.",
    c: "#6E1F2E",
  },
  {
    t: "Timeline",
    d: "Tasks, payments, vendor bookings and the functions in one dated view, phase by phase, with owners and a morning reminder on your phone.",
    c: "#D9962B",
  },
  {
    t: "Vendors",
    d: "A checklist of every vendor your event needs, each with a book-by date, quotes side by side and enquiries drafted for you.",
    c: "#3D7A4F",
  },
  {
    t: "Guests",
    d: "Groups, plus-ones, dietary and stay needs. A no-login RSVP page whose headcount updates catering.",
    c: "#5A6FB8",
  },
  {
    t: "Ideas",
    d: "Themes, menus, décor and savings personalised to your month, guest count, budget and family notes. Plan one and its task and cost appear.",
    c: "#B5452B",
  },
  {
    t: "AI assistant",
    d: "Ask a question or ask for a change, in your language. You see a preview of every edit before it happens.",
    c: "#1F5F6B",
  },
];

export type SampleId = "wedding" | "birthday" | "mela";

/** The demo event each sample opens. */
export const SAMPLE_EVENT: Record<SampleId, string> = {
  wedding: "ananya-rohan",
  birthday: "aarav-6",
  mela: "green-valley-mela",
};

export const SAMPLES: Record<
  SampleId,
  {
    tab: string;
    prompt: string;
    asked: string;
    tasks: { t: string; when: string; urgent?: boolean }[];
    vendors: string[];
    why: string;
  }
> = {
  wedding: {
    tab: "Kerala wedding",
    prompt: "Kerala-style wedding in Kochi with a reception, around 250 guests, ₹18 lakh, end of April.",
    asked: "Venue status · pre-wedding functions · top three priorities",
    tasks: [
      { t: "Confirm muhurtham with astrologer", when: "Week 1" },
      { t: "Visit both shortlisted venues", when: "Week 1" },
      { t: "Book photographer", when: "Week 2", urgent: true },
      { t: "Draft guest list with both families", when: "Week 3" },
      { t: "Sadhya tasting, 2 caterers", when: "Week 4" },
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
      { t: "Book the planetarium show", when: "Week 1" },
      { t: "Order the rocket cake, nut-free", when: "Week 1", urgent: true },
      { t: "Send the invite to the class group", when: "Week 1" },
      { t: "Buy 30 rocket kits for return gifts", when: "Week 2" },
      { t: "Planet balloons and star backdrop", when: "Week 3" },
    ],
    vendors: ["Cake baker", "Planetarium show", "Snacks caterer", "Balloon décor", "Return gifts", "+2 more"],
    why: "Why a nut-free cake: Plannr asked about allergies, and 3 of the 30 kids have nut allergies.",
  },
  mela: {
    tab: "Diwali mela",
    prompt: "Diwali mela for our society: stalls and a cultural night, 600 people, ₹2.5 lakh, 12 volunteers.",
    asked: "Date and grounds · permits already filed · how stalls pay",
    tasks: [
      { t: "File police permission for sound", when: "Week 1", urgent: true },
      { t: "Open stall sign-ups at ₹2,500", when: "Week 1" },
      { t: "Confirm three sponsors", when: "Week 2" },
      { t: "Build the volunteer shifts", when: "Week 3" },
      { t: "Fire safety check for diya stalls", when: "Week 4" },
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
export const EXAMPLES = [
  {
    title: "A Kerala wedding, two families",
    body: "Both families see one budget. Every advance is marked with who paid it, and the 60/40 split shows who owes whom, settled with one tap.",
    color: "#D9962B",
  },
  {
    title: "A birthday in ten days",
    body: "A run sheet for the afternoon, RSVPs with allergy notes from each family, and the return-gift order on the same list as the cake.",
    color: "#5A6FB8",
  },
  {
    title: "A housing society's festival",
    body: "Volunteers pick their own shifts, stallholders request a stall, the treasurer approves expenses, and residents see where the money went.",
    color: "#3D7A4F",
  },
];

export const FAQS = [
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
