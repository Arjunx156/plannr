import type { PlannrEvent, Profile } from "../data/types";
import type { Question, QuestionField } from "../lib/intakeQuestions";
import type { PlanNotes } from "../lib/tailor";
import type { EventAction } from "../shared/engine";
import type { AccountUser, ActivityEntry, PlanSummary, Role, SignInMethods } from "../shared/types";

export interface Session {
  signedIn: boolean;
  name: string;
  firstName: string;
  initials: string;
  city: string;
  language: string;
  plan: string;
}

export interface ChatTurn {
  id: string;
  role: "user" | "ai";
  text: string;
  question?: Question;
}

export interface Draft {
  profile: Profile;
  asked: QuestionField[];
  chat: ChatTurn[];
  guidedStep: number;
  /** Set once the plan is generated, so the summary can be revisited. */
  generated: boolean;
  /** The event the draft becomes when accepted, if it fills in an existing one. */
  forEvent?: string;
  /**
   * What Gemini drafted for this profile: the split, the dates, the vendors and the ideas, kept so they
   * survive signing up on the way to accepting. A new profile clears them.
   */
  notes?: PlanNotes;
}

export interface Toast {
  id: string;
  text: string;
  undo?: Action;
}

/** Where a plan lives on the server, and what this person may do with it. */
export interface RemoteMeta {
  version: number;
  role: Role;
  side: string | null;
}

export interface Account {
  status: "unknown" | "signed-out" | "signed-in";
  user?: AccountUser;
  /** What the server offers; all false when accounts aren't switched on there. */
  methods?: SignInMethods;
}

export interface SyncStatus {
  pending: number;
  offline: boolean;
}

export interface AppState {
  version: 2;
  /** Days the demo story was moved when it was seeded; a new week reseeds it. */
  demoShift: number;
  /**
   * Which sample data the demo events were made from; new samples replace old ones. 0 until the
   * samples have loaded: they're fetched only when someone opens the demo.
   */
  seed?: number;
  /** "demo": everything stays in this browser. "account": plans live on the server and sync. */
  mode: "demo" | "account";
  account: Account;
  /** Server details for each plan in account mode, by event id. */
  remote: Record<string, RemoteMeta>;
  sync: SyncStatus;
  /** Plans made on this device before signing in, waiting to be saved to the account. */
  localImports: PlannrEvent[];
  session: Session;
  events: PlannrEvent[];
  draft: Draft;
  notificationsRead: boolean;
  /** Recent changes across the account's plans, for the inbox. Fetched, never saved. */
  activity: ActivityEntry[];
  /** When the inbox was last opened; newer changes by others count as unread. */
  inboxSeen: string;
  toasts: Toast[];
}

export type Action =
  | EventAction
  | { type: "signIn" }
  | { type: "updateSession"; patch: Partial<Session> }
  | { type: "signOut" }
  | { type: "resetDemo" }
  /** The demo's sample events, once they've loaded. */
  | { type: "seedDemo"; events: PlannrEvent[] }
  | { type: "addEvent"; event: PlannrEvent; remote?: RemoteMeta }
  | { type: "methods"; methods: SignInMethods }
  | { type: "accountStatus"; status: Account["status"] }
  | { type: "enterDemo" }
  | { type: "enterAccount"; user: AccountUser }
  | { type: "leaveAccount" }
  | { type: "setPlans"; plans: PlanSummary[]; skip?: string[] }
  | { type: "syncPlan"; plan: { event: PlannrEvent; version: number; role?: Role; side?: string | null } }
  | { type: "syncStatus"; patch: Partial<SyncStatus> }
  | { type: "dropImport"; id: string }
  | { type: "draft"; patch: Partial<Draft> }
  | { type: "draftReset"; forEvent?: string }
  | { type: "readNotifications" }
  | { type: "setActivity"; activity: ActivityEntry[] }
  | { type: "toast"; toast: Toast }
  | { type: "dismissToast"; id: string };
