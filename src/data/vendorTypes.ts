/** Vendor categories grouped by where they stand. */
export interface Vendors {
  booked: string[];
  talking: string[];
  needed: string[];
  note?: string | undefined;
}

/** How far along a vendor is, from needed to booked. */
export type VendorStage = "needed" | "enquired" | "quoted" | "booked";

/** One quote from a vendor. */
export interface Quote {
  id: string;
  amount: number;
  label: string;
  inclusions?: string | undefined;
  terms?: string | undefined;
  /** The amount is per plate or per guest, not a total. */
  perGuest?: boolean | undefined;
  on?: string | undefined;
  source?: string | undefined;
}

/** A vendor on the plan: category, stage, quotes, payments and contacts. */
export interface Vendor {
  id: string;
  category: string;
  /** Empty while the family is still looking. */
  name: string;
  stage: VendorStage;
  phone?: string | undefined;
  /** UPI id for paying them, e.g. "annapoorna@okhdfc". */
  upi?: string | undefined;
  contact?: string | undefined;
  quotes: Quote[];
  chosenQuote?: string | undefined;
  /** Budget category this vendor's cost belongs to. */
  categoryId?: string | undefined;
  /** When they arrive for each function. */
  arrivals?: { fnId: string; time: string; note?: string }[];
  /** What they need from the family on the day: power, water, a table. */
  needs?: string | undefined;
  notes?: string | undefined;
  lang?: string | undefined;
  rating?: number | undefined;
}
