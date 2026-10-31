import type { PlannrEvent } from "../data/types";

/** Shapes the API sends and receives, shared by the server and the browser. */

export type Role = "owner" | "planner" | "viewer";

/** The sign-in methods this server offers. */
export interface SignInMethods {
  guest: boolean;
  email: boolean;
  google: boolean;
}

/** The signed-in person, as the server describes them. */
export interface AccountUser {
  id: string;
  name: string;
  email: string;
  isAnonymous?: boolean | null | undefined;
}

/** One event as the server stores it, with its version for optimistic locking. */
export interface PlanSummary {
  event: PlannrEvent;
  version: number;
  role: Role;
  side: string | null;
}

/** One change in an event's history: who made it, when, and what it was. */
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

/** A co-planner on an event, with their role. */
export interface Member {
  userId: string;
  name: string;
  email: string | null;
  role: Role;
  side: string | null;
  guest: boolean;
}

/** What an invite link shows before someone joins: the event and the role offered. */
export interface InvitePreview {
  eventId: string;
  eventName: string;
  kind: PlannrEvent["kind"];
  date: string;
  role: Role;
  side: string | null;
  invitedBy: string;
  valid: boolean;
  reason?: string | undefined;
}

/** A comment on a task or record, with its author. */
export interface CommentView {
  id: string;
  body: string;
  by: string | null;
  at: string;
}

/** The kinds of link a planner can share. */
export type LinkKind =
  | "rsvp"
  | "helper"
  | "vendor"
  | "shifts"
  | "fund"
  | "site"
  | "album"
  | "stalls"
  | "gate";

/** A shared link as the planner sees it in settings. */
export interface LinkRow {
  token: string;
  kind: LinkKind;
  target: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A saved plan template, as listed for reuse. */
export interface TemplateRow {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
  /** The date the template's event was on; a new event moves every date by the difference. */
  date: string;
}

/** Owners and co-planners can change a plan; viewers can only read it. */
export function canEdit(role: Role | undefined): boolean {
  return role === "owner" || role === "planner";
}

/** Each role in the family's words. */
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  planner: "Co-planner",
  viewer: "Can view",
};
