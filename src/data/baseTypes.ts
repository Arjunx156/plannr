/** The kinds of event Plannr plans. */
export type Kind = "wedding" | "birthday" | "community" | "other";
/** How urgent something is, from a warning to nothing to do. */
export type Tone = "warn" | "due" | "ok" | "idle";

/** Marigold marks the wedding, indigo the birthday, leaf green the mela. */
export type Hue = "marigold" | "indigo" | "leaf" | "maroon";

/** A colour from Plannr's palette, by name: what data points at instead of a CSS colour. */
export type Swatch = Hue | "peacock" | "rust" | "kasavu" | "ink" | "line-2";

/** Someone on the plan, shown as initials on a coloured circle. */
export interface Person {
  initials: string;
  bg: string;
  fg: string;
  name: string;
}

/** One task on the plan. */
export interface Task {
  id: string;
  title: string;
  who: string;
  due: string;
  done: boolean;
  fn?: string | undefined;
  /** Second line under the title: context, dependency or vendor. */
  note?: string | undefined;
}
/** One function of an event: the haldi, the ceremony, the reception. */
export interface FunctionDay {
  id: string;
  label: string;
  date: string;
  part?: "AM" | "PM" | undefined;
  time?: string | undefined;
  place?: string | undefined;
  /** Street address or a maps link, shown to guests. */
  address?: string | undefined;
  dress?: string | undefined;
  /** Seats at the venue, for capacity warnings. */
  capacity?: number | undefined;
  /** Family-only: left off the event website, shown only to households invited to it. */
  private?: boolean | undefined;
}
