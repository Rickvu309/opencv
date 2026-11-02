import type { CoachMode } from "@workspace/domain"
import { sql } from "drizzle-orm"
import {
  boolean,
  customType,
  date,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const opencvApp = pgSchema("opencv_app")

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
})

export const user = opencvApp.table("user", {
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

export const session = opencvApp.table(
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

export const account = opencvApp.table(
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

export const verification = opencvApp.table(
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

export const files = opencvApp.table(
  "files",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mediaType: text("media_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    purpose: text("purpose").$type<"import" | "avatar">().notNull(),
    bytes: bytea("bytes").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [index("files_user_id_idx").on(table.userId)]
)

export const paperDocs = opencvApp.table(
  "paper_docs",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<"cv" | "letter">().notNull(),
    templateId: text("template_id"),
    document: jsonb("document").$type<Record<string, unknown>>().notNull(),
    contentVersion: integer("content_version").notNull(),
    status: text("status")
      .$type<"draft" | "ready" | "published">()
      .notNull()
      .default("draft"),
    checks: jsonb("checks").$type<
      {
        id: string
        kind: string
        message: string
        blockId?: string
        resolved?: boolean
      }[]
    >(),
    pageChoice: text("page_choice")
      .$type<"unset" | "keep">()
      .notNull()
      .default("unset"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    sourceFileId: uuid("source_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    crdtEpoch: integer("crdt_epoch"),
    crdtBase: bytea("crdt_base"),
    crdtBaseSeq: integer("crdt_base_seq"),
    crdtDocument: jsonb("crdt_document").$type<Record<string, unknown>>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("paper_docs_user_id_updated_at_idx").on(
      table.userId,
      table.updatedAt
    ),
  ]
)

export const paperDocUpdates = opencvApp.table(
  "paper_doc_updates",
  {
    paperId: uuid("paper_id")
      .notNull()
      .references(() => paperDocs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    origin: text("origin").notNull(),
    editId: text("edit_id"),
    update: bytea("update").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.paperId, table.seq] })]
)

export const paperShares = opencvApp.table("paper_shares", {
  id: uuid("id").primaryKey(),
  docId: uuid("doc_id")
    .notNull()
    .references(() => paperDocs.id, { onDelete: "cascade" })
    .unique(),
  token: text("token").notNull().unique(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
})

export const jobs = opencvApp.table(
  "jobs",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    stage: text("stage")
      .$type<"saved" | "applied" | "interview" | "offer" | "closed">()
      .notNull()
      .default("saved"),
    position: text("position").notNull(),
    location: text("location"),
    priority: text("priority")
      .$type<"low" | "normal" | "high">()
      .notNull()
      .default("normal"),
    jobUrl: text("job_url"),
    sourceHost: text("source_host"),
    description: text("description"),
    posting: jsonb("posting").$type<{
      about: string
      duties: string
      requirements: string
      details: string
    } | null>(),
    interviewAt: timestamptz("interview_at"),
    deadline: date("deadline", { mode: "string" }),
    recruiterName: text("recruiter_name"),
    recruiterEmail: text("recruiter_email"),
    cvDocId: uuid("cv_doc_id").references(() => paperDocs.id, {
      onDelete: "set null",
    }),
    letterDocId: uuid("letter_doc_id").references(() => paperDocs.id, {
      onDelete: "set null",
    }),
    starred: boolean("starred").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("jobs_user_id_stage_position_idx").on(
      table.userId,
      table.stage,
      table.position
    ),
    index("jobs_user_id_job_url_idx").on(table.userId, table.jobUrl),
  ]
)

export const jobChecklist = opencvApp.table(
  "job_checklist",
  {
    id: uuid("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
    position: text("position").notNull(),
  },
  (table) => [index("job_checklist_job_id_idx").on(table.jobId, table.position)]
)

export const connections = opencvApp.table(
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

export const inboxThreads = opencvApp.table(
  "inbox_threads",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, {
      onDelete: "cascade",
    }),
    providerThreadId: text("provider_thread_id").notNull(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    company: text("company").notNull().default(""),
    role: text("role").notNull().default(""),
    summary: text("summary").notNull().default(""),
    lastMessageAt: timestamptz("last_message_at"),
    unread: boolean("unread").notNull().default(false),
    status: text("status")
      .$type<"open" | "done" | "snoozed">()
      .notNull()
      .default("open"),
    snoozeUntil: timestamptz("snooze_until"),
    suggestedStage: text("suggested_stage").$type<"interview" | null>(),
    draftBody: text("draft_body"),
    draftTimes: jsonb("draft_times").$type<string[] | null>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inbox_threads_connection_provider_uidx").on(
      table.connectionId,
      table.providerThreadId
    ),
  ]
)

export const inboxMessages = opencvApp.table(
  "inbox_messages",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => inboxThreads.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id").notNull(),
    direction: text("direction").$type<"in" | "out">().notNull(),
    fromName: text("from_name"),
    fromEmail: text("from_email"),
    toEmail: text("to_email"),
    bodyText: text("body_text").notNull().default(""),
    sentAt: timestamptz("sent_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inbox_messages_thread_provider_uidx").on(
      table.threadId,
      table.providerMessageId
    ),
  ]
)

export const chats = opencvApp.table(
  "chats",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    focusKind: text("focus_kind").$type<"paper" | "job" | "inbox" | null>(),
    focusId: uuid("focus_id"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("chats_user_id_updated_at_idx").on(table.userId, table.updatedAt),
    index("chats_user_id_focus_idx").on(
      table.userId,
      table.focusKind,
      table.focusId
    ),
  ]
)

export const chatMessages = opencvApp.table(
  "chat_messages",
  {
    id: uuid("id").primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").$type<"person" | "coach">().notNull(),
    text: text("text").notNull(),
    parts: jsonb("parts").$type<unknown[]>(),
    status: text("status").$type<"final" | "error" | "aborted">(),
    workedMs: integer("worked_ms"),
    supersedesMessageId: uuid("supersedes_message_id").references(
      (): AnyPgColumn => chatMessages.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chat_messages_chat_id_created_at_idx").on(
      table.chatId,
      table.createdAt
    ),
    uniqueIndex("chat_messages_supersedes_message_id_uidx")
      .on(table.supersedesMessageId)
      .where(sql`${table.supersedesMessageId} is not null`),
  ]
)

export const pendingActions = opencvApp.table(
  "pending_actions",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    command: text("command").notNull(),
    input: jsonb("input").notNull(),
    summary: text("summary").notNull(),
    status: text("status")
      .$type<"pending" | "approved" | "denied" | "expired">()
      .notNull()
      .default("pending"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("pending_actions_user_id_idx").on(table.userId, table.status),
  ]
)

export const activity = opencvApp.table(
  "activity",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    actor: text("actor").$type<"person" | "coach">().notNull(),
    command: text("command").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    summary: text("summary").notNull(),
    detail: jsonb("detail"),
    result: jsonb("result").$type<unknown>(),
    reversalCommand: text("reversal_command"),
    reversalInput: jsonb("reversal_input"),
    undoneAt: timestamptz("undone_at"),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    index("activity_user_subject_idx").on(
      table.userId,
      table.subjectKind,
      table.subjectId,
      table.createdAt
    ),
    uniqueIndex("activity_user_idempotency_uidx").on(
      table.userId,
      table.idempotencyKey
    ),
  ]
)

export const idempotency = opencvApp.table(
  "idempotency",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    command: text("command").notNull(),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)

export const coachUsage = opencvApp.table(
  "coach_usage",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id").references(() => chats.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => chatMessages.id, {
      onDelete: "set null",
    }),
    plan: text("plan").$type<"free" | "pro">().notNull(),
    mode: text("mode").$type<CoachMode>().notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    finishReason: text("finish_reason"),
    latencyMs: integer("latency_ms"),
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

export const notifyRequests = opencvApp.table(
  "notify_requests",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topic: text("topic").$type<"jobs" | "proof" | "pitch">().notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notify_requests_user_topic_uidx").on(
      table.userId,
      table.topic
    ),
  ]
)
