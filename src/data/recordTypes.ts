import type { Gift } from "./budgetTypes";
import type { Household, RoomBlock, SeatTable } from "./guestTypes";
import type { Vendor } from "./vendorTypes";

export interface RunItem {
  id: string;
  fnId: string;
  /** 24-hour "HH:MM". */
  time: string;
  title: string;
  owner?: string;
  phone?: string;
  note?: string;
  done?: boolean;
}

export interface CheckItem {
  id: string;
  fnId?: string;
  label: string;
  owner?: string;
  done: boolean;
}

export interface Announcement {
  id: string;
  at: string;
  text: string;
}

export interface Photo {
  id: string;
  url: string;
  by: string;
  at: string;
  caption?: string;
}

/** Something the family wants every suggestion to respect. */
export interface MemoryNote {
  id: string;
  text: string;
}

export interface Idea {
  id: string;
  title: string;
  cost?: number;
  effort?: "low" | "medium" | "high";
  categoryId?: string;
  status: "idea" | "planned" | "dropped";
  note?: string;
  /** Why Plannr suggested it: the detail of this event it answers. */
  because?: string;
}

/** What the event website shows. Off until the hosts publish it. */
export interface SiteInfo {
  published: boolean;
  story?: string;
  /** The same story in the family's language. */
  storyLocal?: string;
  /** Language code for the second language, e.g. "ml". */
  lang?: string;
  faqs?: { q: string; a: string }[];
  /** Let search engines list the page. Off by default. */
  indexable?: boolean;
}

/** Collections every planned event can hold. All optional: older plans simply don't have them yet. */
export interface PlanRecords {
  households?: Household[];
  tables?: SeatTable[];
  rooms?: RoomBlock[];
  vendorList?: Vendor[];
  gifts?: Gift[];
  runsheet?: RunItem[];
  checklist?: CheckItem[];
  announcements?: Announcement[];
  album?: Photo[];
  memory?: MemoryNote[];
  ideas?: Idea[];
  site?: SiteInfo;
}
