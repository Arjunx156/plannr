import type { FunctionDay, Hue, Kind, Person, Task, Tone } from "./baseTypes";
import type { BudgetPlan } from "./budgetTypes";
import type { Approval, FundSource, Pass, Permit, Slot, Sponsor, Stall } from "./communityTypes";
import type { Rsvp } from "./guestTypes";
import type { Message, Notice } from "./messageTypes";
import type { PlanRecords } from "./recordTypes";
import type { Vendors } from "./vendorTypes";

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
