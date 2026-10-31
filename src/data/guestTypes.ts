/** RSVP totals for an event. */
export interface Rsvp {
  total: number;
  invited: number;
  confirmed: number;
  declined: number;
  pending: number;
  notSent: number;
}
// ---------------------------------------------------------------- plan records

/** A household's answer for one function. */
export type RsvpStatus = "pending" | "yes" | "no";
/** A meal preference. */
export type Meal = "veg" | "nonveg" | "jain";

/** A family or group invited together. Most guests never sign up; their household gets a link. */
export interface Household {
  id: string;
  name: string;
  side?: string | undefined;
  /** WhatsApp number, digits only, with country code. */
  phone?: string | undefined;
  /** Language for their invitation and reminders, e.g. "ml". */
  lang?: string | undefined;
  /** People invited. */
  expected: number;
  /** Function ids they're invited to. */
  functions: string[];
  /** Their answer for each function. */
  rsvp: Record<string, { status: RsvpStatus; count: number }>;
  meal?: Meal | undefined;
  stay?: boolean | undefined;
  pickup?: string | undefined;
  needs?: string | undefined;
  note?: string | undefined;
  /** Room block id when they're staying with the family's booking. */
  room?: string | undefined;
  /** Table id for each function with seating. */
  tables?: Record<string, string> | undefined;
  checkedIn?: Record<string, number> | undefined;
  invitedAt?: string | undefined;
  remindedAt?: string | undefined;
  respondedAt?: string | undefined;
}

/** A table at one function, and who sits there. */
export interface SeatTable {
  id: string;
  fnId: string;
  name: string;
  seats: number;
}

/** Rooms held at a hotel for out-of-town guests. */
export interface RoomBlock {
  id: string;
  hotel: string;
  rooms: number;
  nights?: string | undefined;
  rate?: number | undefined;
  note?: string | undefined;
}
