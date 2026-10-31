import type { Gift } from "./budgetTypes";
import type { Household, RoomBlock, SeatTable } from "./guestTypes";
import type { Vendor } from "./vendorTypes";

/** One item on a function's run sheet. */
export interface RunItem {
  id: string;
  fnId: string;
  /** 24-hour "HH:MM". */
  time: string;
  title: string;
  owner?: string | undefined;
  phone?: string | undefined;
  note?: string | undefined;
  done?: boolean | undefined;
}

/** One item on a checklist, for a function or the whole event. */
export interface CheckItem {
  id: string;
  fnId?: string | undefined;
  label: string;
  owner?: string | undefined;
  done: boolean;
}

/** An announcement to everyone on the event. */
export interface Announcement {
  id: string;
  at: string;
  text: string;
}

/** A photo in the shared album. */
export interface Photo {
  id: string;
  url: string;
  by: string;
  at: string;
  caption?: string | undefined;
}

/** Something the family wants every suggestion to respect. */
export interface MemoryNote {
  id: string;
  text: string;
}

/** An idea on the ideas board. */
export interface Idea {
  id: string;
  title: string;
  cost?: number | undefined;
  effort?: "low" | "medium" | "high" | undefined;
  categoryId?: string | undefined;
  status: "idea" | "planned" | "dropped";
  note?: string | undefined;
  /** Why Plannr suggested it: the detail of this event it answers. */
  because?: string | undefined;
}

/** What the event website shows. Off until the hosts publish it. */
export interface SiteInfo {
  published: boolean;
  story?: string | undefined;
  /** The same story in the family's language. */
  storyLocal?: string | undefined;
  /** Language code for the second language, e.g. "ml". */
  lang?: string | undefined;
  faqs?: { q: string; a: string }[];
  /** Let search engines list the page. Off by default. */
  indexable?: boolean | undefined;
}

/** Collections every planned event can hold. All optional: older plans simply don't have them yet. */
export interface PlanRecords {
  households?: Household[] | undefined;
  tables?: SeatTable[] | undefined;
  rooms?: RoomBlock[] | undefined;
  vendorList?: Vendor[] | undefined;
  gifts?: Gift[] | undefined;
  runsheet?: RunItem[] | undefined;
  checklist?: CheckItem[] | undefined;
  announcements?: Announcement[] | undefined;
  album?: Photo[] | undefined;
  memory?: MemoryNote[] | undefined;
  ideas?: Idea[] | undefined;
  site?: SiteInfo | undefined;
}
