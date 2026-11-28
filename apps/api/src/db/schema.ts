import { createAuthLimitTable } from "./auth-limit-schema.js"
import { createAuthTables } from "./auth-schema.js"
import { bytea, timestamptz, type CheckpointUsage } from "./column-types.js"
import { createJobTables } from "./job-schema.js"
import { createCoachUsageTable } from "./coach-usage-schema.js"
import { createOAuthTables } from "./oauth-schema.js"
import type { ReversalExpect } from "@workspace/domain/kernel"
import { sql } from "drizzle-orm"
import {
  bigint,
  check,
  boolean,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const opencvApp = pgSchema("opencv_app")

export const { user, session, account, verification, connections } =
  createAuthTables(opencvApp)

export const authLimitCounters = createAuthLimitTable(opencvApp)

export const {
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
  agentConnections,
  agentToolCalls,
} = createOAuthTables(opencvApp, user, session)

export const authSchema = {
  oauthClient,
  oauthResource,
  oauthClientResource,
  oauthRefreshToken,
  oauthAccessToken,
  oauthConsent,
  oauthClientAssertion,
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
    purpose: text("purpose").$type<"import" | "avatar" | "package">().notNull(),
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
    engine: smallint("engine").notNull().default(1),
    headVersion: integer("head_version").notNull().default(0),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    snapshotVersion: integer("snapshot_version").notNull().default(0),
    firstPage: jsonb("first_page").$type<Record<string, unknown>>(),
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

export const paperChanges = opencvApp.table(
  "paper_changes",
  {
    docId: uuid("doc_id")
      .notNull()
      .references(() => paperDocs.id, { onDelete: "cascade" }),
    fromVersion: integer("from_version").notNull(),
    toVersion: integer("to_version").notNull(),
    editId: text("edit_id").notNull(),
    clientId: text("client_id").notNull(),
    originKind: text("origin_kind").notNull(),
    originActor: text("origin_actor").notNull(),
    proposalId: text("proposal_id"),
    activityId: uuid("activity_id"),
    steps: jsonb("steps").$type<Record<string, unknown>[]>().notNull(),
    inverse: jsonb("inverse").$type<Record<string, unknown>[]>().notNull(),
    commands: jsonb("commands").$type<Record<string, unknown>[]>().notNull(),
    releasedFileIds: text("released_file_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.docId, table.fromVersion] }),
    uniqueIndex("paper_changes_doc_edit_uidx").on(table.docId, table.editId),
    check(
      "paper_changes_versions_ascend",
      sql`${table.toVersion} > ${table.fromVersion}`
    ),
  ]
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

export const { jobs, jobChecklist } = createJobTables(opencvApp, {
  user,
  paperDocs,
})

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
    coachTaskId: uuid("coach_task_id")
      .unique()
      .references((): AnyPgColumn => coachTasks.id),
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
    coachTaskId: uuid("coach_task_id").references(
      (): AnyPgColumn => coachTasks.id
    ),
    coachIntentKey: text("coach_intent_key").unique(),
    delegateConnectionId: uuid("delegate_connection_id").references(
      () => agentConnections.id
    ),
    command: text("command").notNull(),
    input: jsonb("input").notNull(),
    basisRevision: integer("basis_revision"),
    frozenReview: jsonb("frozen_review"),
    summary: text("summary").notNull(),
    status: text("status")
      .$type<"pending" | "approved" | "denied" | "expired">()
      .notNull()
      .default("pending"),
    turnId: uuid("turn_id").references(() => coachUsage.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("pending_actions_user_id_idx").on(table.userId, table.status),
    index("pending_actions_turn_id_idx")
      .on(table.turnId)
      .where(sql`${table.turnId} is not null`),
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
    actor: text("actor").$type<"person" | "coach" | "delegate">().notNull(),
    command: text("command").notNull(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    summary: text("summary").notNull(),
    detail: jsonb("detail"),
    result: jsonb("result").$type<unknown>(),
    reversalCommand: text("reversal_command"),
    reversalInput: jsonb("reversal_input"),
    reversalExpect: jsonb("reversal_expect").$type<ReversalExpect | null>(),
    undoneAt: timestamptz("undone_at"),
    idempotencyKey: text("idempotency_key"),
    inputHash: text("input_hash"),
    turnId: uuid("turn_id").references(() => coachUsage.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("activity_turn_id_idx")
      .on(table.turnId)
      .where(sql`${table.turnId} is not null`),
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
    inputHash: text("input_hash"),
    command: text("command").notNull(),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
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

export const coachTasks = opencvApp.table(
  "coach_tasks",
  {
    id: uuid("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    sourceMessageId: uuid("source_message_id").references(
      () => chatMessages.id
    ),
    assistantMessageId: uuid("assistant_message_id")
      .unique()
      .references(() => chatMessages.id),
    supersedesMessageId: uuid("supersedes_message_id").references(
      () => chatMessages.id
    ),
    startKey: text("start_key").notNull(),
    startInputHash: text("start_input_hash").notNull(),
    state: text("state")
      .$type<
        | "queued"
        | "running"
        | "waitingApproval"
        | "cancelling"
        | "cancelled"
        | "succeeded"
        | "failed"
      >()
      .notNull()
      .default("queued"),
    catalogDigest: text("catalog_digest").notNull(),
    runtimeVersion: integer("runtime_version").notNull(),
    modelId: text("model_id").notNull(),
    mode: text("mode").notNull(),
    planAtStart: text("plan_at_start").notNull(),
    toolsAllowed: boolean("tools_allowed").notNull(),
    contextSnapshot: jsonb("context_snapshot").notNull(),
    leaseOwner: text("lease_owner"),
    leaseEpoch: bigint("lease_epoch", { mode: "number" }).notNull().default(0),
    leaseUntil: timestamptz("lease_until"),
    cancelRequestedAt: timestamptz("cancel_requested_at"),
    cancelProcessedAt: timestamptz("cancel_processed_at"),
    attempt: integer("attempt").notNull().default(0),
    nextSeq: bigint("next_seq", { mode: "number" }).notNull().default(0),
    checkpointVersion: integer("checkpoint_version").notNull().default(0),
    maxSteps: integer("max_steps").notNull(),
    maxTokens: integer("max_tokens").notNull(),
    deadlineAt: timestamptz("deadline_at").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    availableAt: timestamptz("available_at").notNull().defaultNow(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    errorCode: text("error_code"),
  },
  (t) => [
    uniqueIndex("coach_tasks_start_key_uidx").on(t.ownerId, t.startKey),
    uniqueIndex("coach_tasks_active_chat_uidx")
      .on(t.ownerId, t.chatId)
      .where(sql`${t.state} not in ('cancelled', 'succeeded', 'failed')`),
    index("coach_tasks_eligible_idx").on(t.state, t.availableAt, t.leaseUntil),
    check(
      "coach_tasks_state_check",
      sql`${t.state} in ('queued','running','waitingApproval','cancelling','cancelled','succeeded','failed')`
    ),
    check(
      "coach_tasks_bounds_check",
      sql`${t.leaseEpoch} >= 0 and ${t.nextSeq} >= 0 and ${t.maxSteps} > 0 and ${t.maxTokens} > 0`
    ),
  ]
)

export const taskEvents = opencvApp.table(
  "task_events",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => coachTasks.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    epoch: bigint("epoch", { mode: "number" }).notNull(),
    attempt: integer("attempt").notNull(),
    step: integer("step"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    logicalKey: text("logical_key"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.seq] }),
    uniqueIndex("task_events_logical_uidx").on(t.taskId, t.logicalKey),
  ]
)

export const taskCheckpoints = opencvApp.table(
  "task_checkpoints",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => coachTasks.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    completedStep: integer("completed_step").notNull(),
    phase: text("phase").$type<"decision" | "results">().notNull(),
    attempt: integer("attempt").notNull(),
    modelMessages: jsonb("model_messages").notNull(),
    observedRevisions: jsonb("observed_revisions").notNull(),
    usage: jsonb("usage").$type<CheckpointUsage>().notNull(),
    requestManifest: jsonb("request_manifest").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.version] })]
)

export const toolIntents = opencvApp.table(
  "tool_intents",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => coachTasks.id, { onDelete: "cascade" }),
    step: integer("step").notNull(),
    slot: integer("slot").notNull(),
    intentKey: text("intent_key").notNull().unique(),
    providerToolUseId: text("provider_tool_use_id").notNull(),
    operation: text("operation").notNull(),
    operationVersion: integer("operation_version").notNull(),
    input: jsonb("input").notNull(),
    inputHash: text("input_hash").notNull(),
    observedRevisions: jsonb("observed_revisions").notNull(),
    kind: text("kind").$type<"command" | "query">().notNull(),
    state: text("state")
      .$type<
        | "planned"
        | "proposed"
        | "committed"
        | "read"
        | "denied"
        | "stale"
        | "failed"
        | "cancelled"
      >()
      .notNull()
      .default("planned"),
    proposalId: uuid("proposal_id")
      .unique()
      .references(() => pendingActions.id),
    activityId: uuid("activity_id").references(() => activity.id),
    publicResult: jsonb("public_result"),
    errorCode: text("error_code"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.step, t.slot] }),
    uniqueIndex("tool_intents_provider_uidx").on(
      t.taskId,
      t.step,
      t.providerToolUseId
    ),
    index("tool_intents_state_idx").on(t.taskId, t.state),
    check(
      "tool_intents_key_check",
      sql`${t.intentKey} = 'coach:' || ${t.taskId}::text || ':' || ${t.step}::text || ':' || ${t.slot}::text`
    ),
    check("tool_intents_slot_check", sql`${t.step} >= 0 and ${t.slot} >= 0`),
  ]
)

export const coachUsage = createCoachUsageTable(opencvApp, {
  user,
  chats,
  chatMessages,
  coachTasks,
})
