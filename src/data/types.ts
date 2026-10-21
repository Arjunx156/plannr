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

export interface Payment {
  id: string;
  date: string;
  label: string;
  amount: number;
  paid: boolean;
  estimate?: boolean;
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

export interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
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

export interface FamilySplit {
  label: string;
  sides: { name: string; share: number; paid: number; color: string }[];
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

export interface PersonalEvent extends EventBase {
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

export interface CommunityEvent extends EventBase {
  layout: "community";
  countdown: { label: string; line: string };
  segments: { id: string; label: string; line: string }[];
  funds: {
    budget: number;
    spent: number;
    sources: { label: string; expected: number; received: number; note: string; tone: Tone }[];
    approvals: {
      id: string;
      label: string;
      by: string;
      amount: number;
      status: "pending" | "approved" | "declined";
    }[];
  };
  tasks: { total: number; doneBefore: number; list: Task[] };
  permits: { label: string; status: string; tone: Tone; permit?: boolean }[];
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
