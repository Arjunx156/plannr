export interface Rsvp {
  total: number;
  invited: number;
  confirmed: number;
  declined: number;
  pending: number;
  notSent: number;
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
