import type {
  CoachMode,
  CoachUsageRating,
  MessageRole,
  ThreadMessagePart,
  ThreadMessageStatus,
} from "@workspace/domain"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/** App tables live in this schema (ADR-0006). */
// `openpath_app` is a historical schema name kept on purpose (ADR-0011).
export const openpathApp = pgSchema("openpath_app")

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })

/** Better Auth user table — text ids, not app UUIDv7 (ADR-0006). */
export const user = openpathApp.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  coachMode: text("coach_mode").$type<CoachMode>().notNull().default("free"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
})

export const session = openpathApp.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
)

export const account = openpathApp.table(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("account_issuer_account_id_uidx").on(
      table.issuer,
      table.accountId
    ),
    index("account_user_id_idx").on(table.userId),
  ]
)

export const verification = openpathApp.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

export const authSchema = {
  user,
  session,
  account,
  verification,
}

/** App-generated UUIDv7; server owns timestamps (ADR-0006). */
export const threads = openpathApp.table(
  "threads",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    focusDocId: uuid("focus_doc_id").references(() => paperDocs.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("threads_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("threads_user_id_focus_doc_id_idx").on(
      table.userId,
      table.focusDocId
    ),
  ]
)

/** Append-only; rows are removed only when the Thread is deleted. */
export const threadMessages = openpathApp.table(
  "thread_messages",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: text("role").$type<MessageRole>().notNull(),
    text: text("text").notNull(),
    parts: jsonb("parts").$type<ThreadMessagePart[]>(),
    status: text("status").$type<ThreadMessageStatus>(),
    workedMs: integer("worked_ms"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("thread_messages_thread_id_created_at_idx").on(
      table.threadId,
      table.createdAt
    ),
  ]
)

/** Paper docs: kind + jsonb content + version (ADR-0006 / PRODUCT.md q3). */
export const paperDocs = openpathApp.table(
  "paper_docs",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contentKind: text("content_kind")
      .$type<"cv" | "letter" | "proof">()
      .notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    contentVersion: integer("content_version").notNull(),
    status: text("status")
      .$type<"draft" | "ready" | "published">()
      .notNull()
      .default("draft"),
    applyCardId: uuid("apply_card_id").references(() => applyCards.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("paper_docs_user_id_updated_at_idx").on(
      table.userId,
      table.updatedAt
    ),
    index("paper_docs_apply_card_id_idx").on(table.applyCardId),
  ]
)

/** Apply cards: Stage + fractional position; `fit` is stored, never in DTOs. */
export const applyCards = openpathApp.table(
  "apply_cards",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    note: text("note").notNull().default(""),
    stage: text("stage")
      .$type<"inbox" | "prep" | "sent" | "live" | "closed">()
      .notNull(),
    position: text("position").notNull(),
    starred: boolean("starred").notNull().default(false),
    jobUrl: text("job_url"),
    demo: boolean("demo").notNull().default(false),
    trackDate: date("track_date", { mode: "string" }).notNull(),
    trackKind: text("track_kind")
      .$type<"interview" | "deadline" | "followup" | "applied">()
      .notNull(),
    fit: integer("fit").notNull().default(0),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("apply_cards_user_id_stage_position_idx").on(
      table.userId,
      table.stage,
      table.position
    ),
    index("apply_cards_user_id_track_date_idx").on(
      table.userId,
      table.trackDate
    ),
  ]
)

/**
 * One Pitch document per User (ADR-0006): kind + jsonb + version.
 * Unique on user_id — there is never a second Pitch row.
 */
export const pitchDocs = openpathApp.table(
  "pitch_docs",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contentKind: text("content_kind")
      .$type<"pitch">()
      .notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    contentVersion: integer("content_version").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pitch_docs_user_id_uidx").on(table.userId),
  ]
)

/**
 * One row per Coach turn. Rate-limit counter and thumbs sink (ADR-0007).
 * Thread/message FKs set-null so deleting a Thread does not refund the daily cap.
 */
export const coachUsage = openpathApp.table(
  "coach_usage",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => threadMessages.id, {
      onDelete: "set null",
    }),
    model: text("model").notNull(),
    mode: text("mode").$type<CoachMode>().notNull().default("free"),
    tokens: integer("tokens"),
    costEstimate: numeric("cost_estimate"),
    latencyMs: integer("latency_ms"),
    finishReason: text("finish_reason"),
    rating: text("rating").$type<CoachUsageRating>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("coach_usage_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    uniqueIndex("coach_usage_message_id_uidx").on(table.messageId),
  ]
)
