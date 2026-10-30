import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PlannrEvent } from "../../src/data/types";
import type { EventAction } from "../../src/shared/engine";
import type { Role } from "../../src/shared/types";

// ---------------------------------------------------------------- accounts (Better Auth)

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** A guest account: kept on the server, upgraded later by adding Google or an email. */
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** Better Auth's rate-limit counters, kept in the database so every server instance shares them. */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------- plans

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The plan as it is now. */
    data: jsonb("data").$type<PlannrEvent>().notNull(),
    /** The plan as it was created; history is replayed from here for undo. */
    base: jsonb("base").$type<PlannrEvent>().notNull(),
    /** Bumped on every change; clients send it back to detect that someone else changed the plan. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("events_owner_idx").on(t.ownerId)],
);

export const members = pgTable(
  "members",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    /** Which family or group they plan for, e.g. "Bride's side". */
    side: text("side"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index("members_user_idx").on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    token: text("token").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    side: text("side"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    uses: integer("uses").notNull().default(0),
    maxUses: integer("max_uses"),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => [index("invites_event_idx").on(t.eventId)],
);

export type ChangeKind = "action" | "undo" | "redo";

export const changes = pgTable(
  "changes",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** The event version this change produced. */
    seq: integer("seq").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Who acted through a shared link, when it wasn't a signed-in member: "Meena aunty (RSVP)". */
    actor: text("actor"),
    kind: text("kind").$type<ChangeKind>().notNull(),
    action: jsonb("action").$type<EventAction>(),
    /** For undo and redo: the change they act on. */
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    /** Assistant conversation: replayed, but hidden from history and never undone on its own. */
    quiet: boolean("quiet").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    undoneAt: timestamp("undone_at"),
    undoneBy: text("undone_by"),
  },
  (t) => [uniqueIndex("changes_event_seq_idx").on(t.eventId, t.seq)],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("comments_record_idx").on(t.eventId, t.recordType, t.recordId)],
);

/** Pages people open without signing in: an RSVP, a helper's tasks, a vendor's call sheet. */
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

export const links = pgTable(
  "links",
  {
    /** The code in the URL. For the event website it is a readable slug. */
    token: text("token").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind").$type<LinkKind>().notNull(),
    /** The household, helper or vendor the link is for; empty for links about the whole event. */
    target: text("target").notNull().default(""),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [uniqueIndex("links_target_idx").on(t.eventId, t.kind, t.target)],
);

/** AI calls per person (or per address for guests) per day, for limits and the cost view. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    key: text("key").notNull(),
    day: text("day").notNull(),
    calls: integer("calls").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.day] })],
);

/** Crashes and server errors, kept for a few weeks so they can be fixed. */
export const errors = pgTable(
  "errors",
  {
    id: text("id").primaryKey(),
    at: timestamp("at").notNull().defaultNow(),
    source: text("source").$type<"client" | "server">().notNull(),
    message: text("message").notNull(),
    stack: text("stack"),
    url: text("url"),
    userAgent: text("user_agent"),
    release: text("release"),
    userId: text("user_id"),
  },
  (t) => [index("errors_at_idx").on(t.at)],
);

/** Counts only, never people: how many visits, plans and invitations each day. */
export const metrics = pgTable(
  "metrics",
  {
    day: text("day").notNull(),
    name: text("name").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.name] })],
);

/** A finished event saved to start the next one from: next year's mela starts from this one. */
export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    data: jsonb("data").$type<PlannrEvent>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("templates_owner_idx").on(t.ownerId)],
);

/** Phones and browsers that asked for reminders: the morning list of what's due. */
export const pushSubs = pgTable(
  "push_subs",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSentAt: timestamp("last_sent_at"),
  },
  (t) => [index("push_subs_user_idx").on(t.userId)],
);

export const schema = {
  user,
  session,
  account,
  verification,
  rateLimit,
  events,
  members,
  invites,
  changes,
  comments,
  links,
  aiUsage,
  errors,
  metrics,
  templates,
  pushSubs,
};
