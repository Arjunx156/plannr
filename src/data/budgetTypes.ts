import type { Tone } from "./baseTypes";

/** Where a line item's money stands. */
export type PayStatus = "paid" | "advance" | "unpaid" | "included" | "quote";

/** One item under a budget line. */
export interface LineItem {
  id: string;
  name: string;
  vendor: string;
  amount: number;
  /** An estimate, not a quote yet. */
  estimate?: boolean | undefined;
  status: PayStatus;
  due?: string | undefined;
}

/** A budget line: what's planned, committed and spent. */
export interface Category {
  id: string;
  name: string;
  planned: number;
  spent: number;
  /** Expected final cost when it differs from the plan. */
  projected?: number | undefined;
  status: string;
  tone: Tone;
  note?: string | undefined;
  items: LineItem[];
}

/** How a payment was made. */
export type PayMethod = "upi" | "cash" | "bank" | "card" | "cheque";

/** One amount on the payment schedule: an advance, a balance or any other instalment. */
export interface Payment {
  id: string;
  date: string;
  label: string;
  amount: number;
  paid: boolean;
  estimate?: boolean | undefined;
  vendorId?: string | undefined;
  categoryId?: string | undefined;
  paidOn?: string | undefined;
  method?: PayMethod | undefined;
  /** Which family side paid it, for the split. */
  by?: string | undefined;
}

/** A way to save money that the planner can apply. */
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
  note?: string | undefined;
}

/** How the budget is shared between families or sides. */
export interface FamilySplit {
  label: string;
  sides: { name: string; share: number; paid: number; color: string }[];
  settlements?: Settlement[] | undefined;
}

/** A budget line priced per guest, for what-ifs on the guest count. */
export interface WhatIfRate {
  category: string;
  perGuest: number;
}

/** An event's whole budget: lines, payments, savings and any split. */
export interface BudgetPlan {
  total: number;
  committed: number;
  categories: Category[];
  payments: Payment[];
  savings: Saving[];
  split?: FamilySplit | undefined;
  byFunction?: { fn: string; planned: number; spent: number }[];
  whatIf?: { baseGuests: number; min: number; max: number; rates: WhatIfRate[] } | undefined;
  /** Footnote on where the split came from. */
  source: string;
  dueSoon?: { label: string; amount: number }[];
}
/** A gift received, and whether it has been thanked for. */
export interface Gift {
  id: string;
  from: string;
  householdId?: string | undefined;
  amount?: number | undefined;
  item?: string | undefined;
  fnId?: string | undefined;
  thanked?: boolean | undefined;
  thankNote?: string | undefined;
}
