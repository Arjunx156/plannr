import type { Tone } from "./baseTypes";

/** A stall at a community event: who runs it, the fee and whether it's paid. */
export interface Stall {
  id: string;
  name: string;
  owner: string;
  phone?: string | undefined;
  category?: string | undefined;
  fee: number;
  paid: boolean;
  status: "requested" | "confirmed";
}

/** An entry pass, checked at the gate. */
export interface Pass {
  id: string;
  name: string;
  count: number;
  phone?: string | undefined;
  checkedIn?: number | undefined;
}

/** A sponsor and what they gave. */
export interface Sponsor {
  id: string;
  name: string;
  tier: string;
  amount: number;
  received: number;
}
/** A volunteer shift: how many are needed, and who signed up. */
export interface Slot {
  need: number;
  names: string[];
}

/** A permit or booking the event needs, and where it stands. */
export interface Permit {
  id?: string | undefined;
  label: string;
  status: string;
  tone: Tone;
  permit?: boolean | undefined;
  due?: string | undefined;
  /** Letter drafted for the authority, kept with the permit. */
  letter?: string | undefined;
}

/** Money expected from one source: dues, a grant, a collection. */
export interface FundSource {
  id?: string | undefined;
  label: string;
  expected: number;
  received: number;
  note: string;
  tone: Tone;
}

/** An expense waiting for the treasurer's approval. */
export interface Approval {
  id: string;
  label: string;
  by: string;
  amount: number;
  status: "pending" | "approved" | "declined";
  category?: string | undefined;
  /** Who decided, by name. */
  decidedBy?: string | undefined;
}
