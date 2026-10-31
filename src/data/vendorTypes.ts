export interface Vendors {
  booked: string[];
  talking: string[];
  needed: string[];
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
