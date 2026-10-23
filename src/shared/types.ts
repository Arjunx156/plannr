import type { PlannrEvent } from "../data/types";

/** Shapes the API sends and receives, shared by the server and the browser. */

export type Role = "owner" | "planner" | "viewer";

export interface SignInMethods {
  guest: boolean;
  email: boolean;
  google: boolean;
}

export interface AccountUser {
  id: string;
  name: string;
  email: string;
  isAnonymous?: boolean | null;
}

export interface PlanSummary {
  event: PlannrEvent;
  version: number;
  role: Role;
  side: string | null;
}

export interface HistoryEntry {
  id: string;
  seq: number;
  kind: "action" | "undo" | "redo";
  summary: string;
  at: string;
  by: string | null;
  byId: string | null;
  undone: boolean;
  targetId: string | null;
}

/** One change in the inbox: what happened, where and who did it. */
export interface ActivityEntry {
  id: string;
  eventId: string;
  eventName: string;
  kind: "action" | "undo" | "redo";
  summary: string;
  at: string;
  by: string | null;
  mine: boolean;
}

export interface Member {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  side: string | null;
  guest: boolean;
}

export interface InvitePreview {
  eventId: string;
  eventName: string;
  kind: PlannrEvent["kind"];
  date: string;
  role: Role;
  side: string | null;
  invitedBy: string;
  valid: boolean;
  reason?: string;
}

export interface CommentView {
  id: string;
  body: string;
  by: string | null;
  at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  planner: "Co-planner",
  viewer: "Can view",
};
