export type Kind = "wedding" | "birthday" | "community" | "other";
export type Tone = "warn" | "due" | "ok" | "idle";

/** Marigold marks the wedding, indigo the birthday, leaf green the mela. */
export type Hue = "marigold" | "indigo" | "leaf" | "maroon";

export interface Person {
  initials: string;
  bg: string;
  fg: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  who: string;
  due: string;
  done: boolean;
  fn?: string;
  /** Second line under the title: context, dependency or vendor. */
  note?: string;
}
export interface FunctionDay {
  id: string;
  label: string;
  date: string;
  part?: "AM" | "PM";
  time?: string;
  place?: string;
  /** Street address or a maps link, shown to guests. */
  address?: string;
  dress?: string;
  /** Seats at the venue, for capacity warnings. */
  capacity?: number;
  /** Family-only: left off the event website, shown only to households invited to it. */
  private?: boolean;
}
