import type { Tone } from "./baseTypes";

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
