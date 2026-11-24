import { z } from "zod"

import { commandContract, commandEntry } from "./contract.js"
import { activityIdSchema, pendingActionIdSchema } from "./ids.js"
import type { QueryRef } from "./queries.js"

const approveInputSchema = z
  .object({
    pendingActionId: pendingActionIdSchema,
  })
  .strict()

const undoInputSchema = z
  .object({
    activityId: activityIdSchema,
  })
  .strict()

const activityRowAsTheApiReturnsIt = z
  .object({
    id: z.string(),
    userId: z.string(),
    createdAt: z.string().datetime(),
    actor: z.enum(["person", "coach", "delegate"]),
    command: z.string(),
    subjectKind: z.string(),
    subjectId: z.string(),
    summary: z.string(),
    detail: z.unknown(),
    result: z.unknown(),
    reversalCommand: z.string().nullable(),
    reversalInput: z.unknown(),
    reversalExpect: z.unknown(),
    undoneAt: z.string().datetime().nullable(),
    idempotencyKey: z.string().nullable(),
    turnId: z.string().nullable(),
  })
  .strict()

export type ActivityRow = z.output<typeof activityRowAsTheApiReturnsIt>

const pendingActionRowSchema = z
  .object({
    delegateConnectionId: z.string().uuid().nullable(),
    id: z.string(),
    userId: z.string(),
    chatId: z.string(),
    command: z.string(),
    input: z.unknown(),
    summary: z.string(),
    status: z.enum(["pending", "approved", "denied", "expired"]),
    turnId: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict()

export type PendingActionRow = z.output<typeof pendingActionRowSchema>

const readsAnUndoOrApprovalCanChange = (): QueryRef[] => [
  { query: "job.list" },
  { query: "job.get" },
  { query: "job.calendar" },
  { query: "paper.list" },
  { query: "paper.get" },
  { query: "paper.document" },
  { query: "paper.pageCount" },
  { query: "paper.outline" },
  { query: "paper.keywordGap" },
  { query: "paper.isDeleted" },
  { query: "inbox.list" },
  { query: "inbox.get" },
  { query: "inbox.snoozed" },
  { query: "chat.list" },
  { query: "chat.get" },
]

export const controlContract = commandContract({
  "actions.approve": commandEntry({
    description: "Run a pending Coach action.",
    input: approveInputSchema,
    output: activityRowAsTheApiReturnsIt.nullable(),
    coach: "never",
    destructive: false,
    step: () => "Approve",
    invalidates: readsAnUndoOrApprovalCanChange,
  }),
  "actions.deny": commandEntry({
    description: "Decline a pending Coach action.",
    input: approveInputSchema,
    output: pendingActionRowSchema,
    coach: "never",
    destructive: false,
    step: () => "Decline",
    invalidates: () => [],
  }),
  "activity.undo": commandEntry({
    description: "Undo one activity row.",
    input: undoInputSchema,
    output: activityRowAsTheApiReturnsIt,
    coach: "never",
    destructive: false,
    step: () => "Undo",
    invalidates: readsAnUndoOrApprovalCanChange,
  }),
})
