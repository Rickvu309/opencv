import type { CoachMode } from "@workspace/domain"
import {
  boolean,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type PgSchema,
} from "drizzle-orm/pg-core"

export function createAuthTables(opencvApp: PgSchema<"opencv_app">) {
  const timestamptz = (name: string) =>
    timestamp(name, { withTimezone: true, mode: "date" })
  const user = opencvApp.table("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    plan: text("plan").$type<"free" | "pro">().notNull().default("free"),
    coachMode: text("coach_mode").$type<CoachMode>().notNull().default("free"),
    language: text("language").$type<"en" | "vi">().notNull().default("en"),
    timeZone: text("time_zone").notNull().default("Asia/Ho_Chi_Minh"),
    startPage: text("start_page")
      .$type<"apply" | "paper" | "inbox" | "coach">()
      .notNull()
      .default("apply"),
    notifyEmail: boolean("notify_email").notNull().default(true),
    notifyBrowser: boolean("notify_browser").notNull().default(false),
    memoryEnabled: boolean("memory_enabled").notNull().default(true),
    agentChat: boolean("agent_chat").notNull().default(true),
    agentCvs: boolean("agent_cvs").notNull().default(true),
    agentInterview: boolean("agent_interview").notNull().default(true),
    agentEmail: boolean("agent_email").notNull().default(true),
    agentWeekly: boolean("agent_weekly").notNull().default(false),
    welcomedAt: timestamptz("welcomed_at"),
    inboxSkippedAt: timestamptz("inbox_skipped_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  })

  const session = opencvApp.table(
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

  const account = opencvApp.table(
    "account",
    {
      id: text("id").primaryKey(),
      issuer: text("issuer"),
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
    (table) => [index("account_user_id_idx").on(table.userId)]
  )

  const verification = opencvApp.table(
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

  const connections = opencvApp.table(
    "connections",
    {
      id: uuid("id").primaryKey(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      provider: text("provider").$type<"gmail" | "gcalendar">().notNull(),
      email: text("email"),
      accessToken: text("access_token"),
      refreshToken: text("refresh_token"),
      expiresAt: timestamptz("expires_at"),
      scope: text("scope"),
      status: text("status")
        .$type<"active" | "expired">()
        .notNull()
        .default("active"),
      syncCursor: text("sync_cursor"),
      createdAt: timestamptz("created_at").notNull().defaultNow(),
    },
    (table) => [
      uniqueIndex("connections_user_provider_uidx").on(
        table.userId,
        table.provider
      ),
    ]
  )

  return { user, session, account, verification, connections }
}
