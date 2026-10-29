export type Kind = "wedding" | "birthday" | "community" | "other";
export type Tone = "warn" | "due" | "ok" | "idle";

/** Marigold marks the wedding, indigo the birthday, leaf green the mela. */
export type Hue = "marigold" | "indigo" | "leaf" | "maroon";

export interface Person {
  initials: string;
  bg: string;
  fg: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  who: string;
  due: string;
  done: boolean;
  fn?: string;
  /** Second line under the title: context, dependency or vendor. */
  note?: string;
}

export type PayStatus = "paid" | "advance" | "unpaid" | "included" | "quote";

export interface LineItem {
  id: string;
  name: string;
  vendor: string;
  amount: number;
  /** An estimate, not a quote yet. */
  estimate?: boolean;
  status: PayStatus;
  due?: string;
}

export interface Category {
  id: string;
  name: string;
  planned: number;
  spent: number;
  /** Expected final cost when it differs from the plan. */
  projected?: number;
  status: string;
  tone: Tone;
  note?: string;
  items: LineItem[];
}

export type PayMethod = "upi" | "cash" | "bank" | "card" | "cheque";

/** One amount on the payment schedule: an advance, a balance or any other instalment. */
export interface Payment {
  id: string;
  date: string;
  label: string;
  amount: number;
  paid: boolean;
  estimate?: boolean;
  vendorId?: string;
  categoryId?: string;
  paidOn?: string;
  method?: PayMethod;
  /** Which family side paid it, for the split. */
  by?: string;
}

export interface Saving {
  id: string;
  title: string;
  amount: number;
  why: string;
  category: string;
}

export interface FunctionDay {
  id: string;
  label: string;
  date: string;
  part?: "AM" | "PM";
  time?: string;
  place?: string;
  /** Street address or a maps link, shown to guests. */
  address?: string;
  dress?: string;
  /** Seats at the venue, for capacity warnings. */
  capacity?: number;
  /** Family-only: left off the event website, shown only to households invited to it. */
  private?: boolean;
}

export type ActionId =
  | "compare-photographers"
  | "remind"
  | "open-savings"
  | "accept-overrun"
  | "review-guest-changes"
  | "dismiss"
  | "draft-permit"
  | "add-areca"
  | "add-stars"
  | "order-cake"
  | "acknowledge"
  | "add-tip"
  | "open-approvals";

export interface Notice {
  id: string;
  tone: "warn" | "ai" | "info";
  label: string;
  text: string;
  why?: string;
  lines?: string[];
  primary?: { label: string; action: ActionId };
  secondary?: { label: string; action: ActionId };
  status: "open" | "done" | "dismissed";
  result?: string;
}

export interface PreviewRow {
  title: string;
  from?: string;
  to?: string;
  detail?: string;
  headsUp?: boolean;
  amount?: string;
}

export interface Preview {
  id: string;
  title: string;
  tag: string;
  rows: PreviewRow[];
  status: "pending" | "applied" | "rejected";
  /** Which mutation applying this preview performs. */
  change: ChangeId;
}

export type ChangeId = "move-haldi" | "cut-decor" | "areca-plates";

/** A change the assistant proposed, in its own small vocabulary; turned into plan changes on the device. */
export interface AiProposal {
  kind:
    | "addTask"
    | "moveTask"
    | "completeTask"
    | "setHeadcount"
    | "setBudgetLine"
    | "remember"
    | "announce"
    | "moveFunction"
    | "addChecklist";
  taskId?: string;
  title?: string;
  due?: string;
  who?: string;
  guests?: number;
  categoryId?: string;
  amount?: number;
  text?: string;
  fnId?: string;
  date?: string;
  label?: string;
}

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Changes the assistant proposed, waiting for the planner's yes. */
  proposals?: AiProposal[];
  proposalStatus?: "pending" | "applied" | "rejected";
  lang?: string;
  /** e.g. "Voice · Malayalam · “Move haldi to Friday”" */
  caption?: string;
  /** Teal source line under an AI answer. */
  source?: string;
  action?: { label: string; id: ActionId; done?: boolean };
  preview?: Preview;
  /** Extra AI line after a preview, e.g. "Why these: …" */
  footnote?: string;
  translation?: string;
}

export interface Rsvp {
  total: number;
  invited: number;
  confirmed: number;
  declined: number;
  pending: number;
  notSent: number;
}

export interface Vendors {
  booked: string[];
  talking: string[];
  needed: string[];
  note?: string;
}

/** Money one family side passed to another to even out the split. */
export interface Settlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  on: string;
  note?: string;
}

export interface FamilySplit {
  label: string;
  sides: { name: string; share: number; paid: number; color: string }[];
  settlements?: Settlement[];
}

export interface WhatIfRate {
  category: string;
  perGuest: number;
}

export interface BudgetPlan {
  total: number;
  committed: number;
  categories: Category[];
  payments: Payment[];
  savings: Saving[];
  split?: FamilySplit;
  byFunction?: { fn: string; planned: number; spent: number }[];
  whatIf?: { baseGuests: number; min: number; max: number; rates: WhatIfRate[] };
  /** Footnote on where the split came from. */
  source: string;
  dueSoon?: { label: string; amount: number }[];
}

// ---------------------------------------------------------------- plan records

export type RsvpStatus = "pending" | "yes" | "no";
export type Meal = "veg" | "nonveg" | "jain";

/** A family or group invited together. Most guests never sign up; their household gets a link. */
export interface Household {
  id: string;
  name: string;
  side?: string;
  /** WhatsApp number, digits only, with country code. */
  phone?: string;
  /** Language for their invitation and reminders, e.g. "ml". */
  lang?: string;
  /** People invited. */
  expected: number;
  /** Function ids they're invited to. */
  functions: string[];
  /** Their answer for each function. */
  rsvp: Record<string, { status: RsvpStatus; count: number }>;
  meal?: Meal;
  stay?: boolean;
  pickup?: string;
  needs?: string;
  note?: string;
  /** Room block id when they're staying with the family's booking. */
  room?: string;
  /** Table id for each function with seating. */
  tables?: Record<string, string>;
  checkedIn?: Record<string, number>;
  invitedAt?: string;
  remindedAt?: string;
  respondedAt?: string;
}

export interface SeatTable {
  id: string;
  fnId: string;
  name: string;
  seats: number;
}

export interface RoomBlock {
  id: string;
  hotel: string;
  rooms: number;
  nights?: string;
  rate?: number;
  note?: string;
}

export type VendorStage = "needed" | "enquired" | "quoted" | "booked";

export interface Quote {
  id: string;
  amount: number;
  label: string;
  inclusions?: string;
  terms?: string;
  /** The amount is per plate or per guest, not a total. */
  perGuest?: boolean;
  on?: string;
  source?: string;
}

export interface Vendor {
  id: string;
  category: string;
  /** Empty while the family is still looking. */
  name: string;
  stage: VendorStage;
  phone?: string;
  /** UPI id for paying them, e.g. "annapoorna@okhdfc". */
  upi?: string;
  contact?: string;
  quotes: Quote[];
  chosenQuote?: string;
  /** Budget category this vendor's cost belongs to. */
  categoryId?: string;
  /** When they arrive for each function. */
  arrivals?: { fnId: string; time: string; note?: string }[];
  /** What they need from the family on the day: power, water, a table. */
  needs?: string;
  notes?: string;
  lang?: string;
  rating?: number;
}

export interface Gift {
  id: string;
  from: string;
  householdId?: string;
  amount?: number;
  item?: string;
  fnId?: string;
  thanked?: boolean;
  thankNote?: string;
}

export interface RunItem {
  id: string;
  fnId: string;
  /** 24-hour "HH:MM". */
  time: string;
  title: string;
  owner?: string;
  phone?: string;
  note?: string;
  done?: boolean;
}

export interface CheckItem {
  id: string;
  fnId?: string;
  label: string;
  owner?: string;
  done: boolean;
}

export interface Announcement {
  id: string;
  at: string;
  text: string;
}

export interface Photo {
  id: string;
  url: string;
  by: string;
  at: string;
  caption?: string;
}

/** Something the family wants every suggestion to respect. */
export interface MemoryNote {
  id: string;
  text: string;
}

export interface Idea {
  id: string;
  title: string;
  cost?: number;
  effort?: "low" | "medium" | "high";
  categoryId?: string;
  status: "idea" | "planned" | "dropped";
  note?: string;
}

export interface Stall {
  id: string;
  name: string;
  owner: string;
  phone?: string;
  category?: string;
  fee: number;
  paid: boolean;
  status: "requested" | "confirmed";
}

export interface Pass {
  id: string;
  name: string;
  count: number;
  phone?: string;
  checkedIn?: number;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: string;
  amount: number;
  received: number;
}

/** What the event website shows. Off until the hosts publish it. */
export interface SiteInfo {
  published: boolean;
  story?: string;
  /** The same story in the family's language. */
  storyLocal?: string;
  /** Language code for the second language, e.g. "ml". */
  lang?: string;
  faqs?: { q: string; a: string }[];
  /** Let search engines list the page. Off by default. */
  indexable?: boolean;
}

/** Collections every planned event can hold. All optional: older plans simply don't have them yet. */
export interface PlanRecords {
  households?: Household[];
  tables?: SeatTable[];
  rooms?: RoomBlock[];
  vendorList?: Vendor[];
  gifts?: Gift[];
  runsheet?: RunItem[];
  checklist?: CheckItem[];
  announcements?: Announcement[];
  album?: Photo[];
  memory?: MemoryNote[];
  ideas?: Idea[];
  site?: SiteInfo;
}

interface EventBase {
  id: string;
  kind: Kind;
  name: string;
  role: "OWNER" | "CO-PLANNER" | "ORGANISER";
  hue: Hue;
  /** Mono label above the dashboard title. */
  eyebrow: string;
  /** Short line in the event card of the side nav. */
  navMeta: string;
  /** Line under the name in the My events list. */
  listMeta: string;
  date: string;
  archived?: boolean;
}

export interface PersonalEvent extends EventBase, PlanRecords {
  layout: "personal";
  countdown: { label: string; line: string; theme: "maroon" | "indigo" };
  functions: FunctionDay[];
  people: Person[];
  morePeople: number;
  pace: string;
  budget: BudgetPlan;
  budgetScore: number;
  budgetNote: string;
  tasks: { total: number; doneBefore: number; list: Task[] };
  vendors: Vendors;
  rsvp: Rsvp;
  notices: Notice[];
  assistant: { intro: string; thread: Message[]; chips: string[] };
  home: { budgetNote: { text: string; tone: Tone }; readinessNote: { text: string; tone: Tone } };
  guests: number;
}

export interface Slot {
  need: number;
  names: string[];
}

export interface Permit {
  id?: string;
  label: string;
  status: string;
  tone: Tone;
  permit?: boolean;
  due?: string;
  /** Letter drafted for the authority, kept with the permit. */
  letter?: string;
}

export interface FundSource {
  id?: string;
  label: string;
  expected: number;
  received: number;
  note: string;
  tone: Tone;
}

export interface Approval {
  id: string;
  label: string;
  by: string;
  amount: number;
  status: "pending" | "approved" | "declined";
  category?: string;
  /** Who decided, by name. */
  decidedBy?: string;
}

export interface CommunityEvent extends EventBase, PlanRecords {
  layout: "community";
  /** The day's programme; a single "day" function is assumed when absent. */
  functions?: FunctionDay[];
  stallList?: Stall[];
  passList?: Pass[];
  sponsors?: Sponsor[];
  countdown: { label: string; line: string };
  segments: { id: string; label: string; line: string }[];
  funds: {
    budget: number;
    spent: number;
    sources: FundSource[];
    approvals: Approval[];
  };
  tasks: { total: number; doneBefore: number; list: Task[] };
  permits: Permit[];
  passes: { issued: number; capacity: number };
  stalls: { booked: number; total: number };
  shifts: { slots: string[]; roles: { role: string; slots: Slot[] }[] };
  volunteers: string[];
  notices: Notice[];
  assistant: { intro: string; thread: Message[]; chips: string[] };
  home: { budgetNote: { text: string; tone: Tone }; readinessNote: { text: string; tone: Tone } };
}

export interface EmptyEvent extends EventBase {
  layout: "empty";
  sharedBy: string;
}

export type PlannrEvent = PersonalEvent | CommunityEvent | EmptyEvent;

export interface PastEvent {
  id: string;
  name: string;
  kind: Kind;
  date: string;
  summary: string;
  archived?: boolean;
}

export interface NotificationItem {
  id: string;
  text: string;
  when: string;
  eventId?: string;
  unread: boolean;
}

/** What the intake has understood so far. Both intake doors write to this. */
export interface Profile {
  kind?: Kind;
  style?: string;
  names?: string;
  functions: string[];
  dateText?: string;
  date?: string;
  city?: string;
  venueStatus?: "Booked" | "Shortlisted" | "Not started";
  venues?: string;
  guests?: number;
  budget?: number;
  traditions?: string;
  needs: string[];
  moods: string[];
  colours: string[];
  inspiration: string[];
  priorities: string[];
  cuts: string[];
  coPlanners: string[];
}
