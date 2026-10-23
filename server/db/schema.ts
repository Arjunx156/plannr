import {
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

// ---------------------------------------------------------------- plans

export type Role = "owner" | "planner" | "viewer";

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

export const schema = { user, session, account, verification, events, members, invites, changes, comments };
