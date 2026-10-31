import type { Tone } from "./baseTypes";

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
