import { z } from "zod"
import { coachTurnRequestSchema } from "./chat-messages.js"
import { chatDetailSchema } from "./chat-views.js"
import { chatIdSchema, idResult, type ChatId } from "./ids.js"
import type { ResourceRef } from "./resources.js"

export const coachConfigSchema = z.object({ coachDurable: z.boolean() })

export const coachTaskErrorCodeSchema = z.enum([
  "BUDGET_EXCEEDED",
  "DEADLINE_EXCEEDED",
  "REPLY_SUPERSEDED",
  "TASK_FAILED",
])
export type CoachTaskErrorCode = z.output<typeof coachTaskErrorCodeSchema>
const coachTaskCursorSchema = z
  .number()
  .int()
  .min(-1)
  .max(Number.MAX_SAFE_INTEGER)
const coachTaskIdSchema = z.string().uuid()
const coachTaskStateSchema = z.enum([
  "queued",
  "running",
  "waitingApproval",
  "cancelling",
  "cancelled",
  "succeeded",
  "failed",
])
export const coachStartInputSchema = coachTurnRequestSchema.safeExtend({
  chatId: chatIdSchema,
  startKey: z.string().uuid(),
})
const coachStartReceiptSchema = z
  .object({
    taskId: coachTaskIdSchema,
    chatId: idResult<ChatId>(),
    acceptedAt: z.string().datetime(),
  })
  .strict()
export const coachStartOutputSchema = z
  .object({
    taskId: coachTaskIdSchema,
    chatId: idResult<ChatId>(),
    receipt: coachStartReceiptSchema,
  })
  .strict()
export const coachTaskEventSchema = z
  .object({
    taskId: coachTaskIdSchema,
    seq: coachTaskCursorSchema.refine((seq) => seq >= 0),
    epoch: z.number().int().nonnegative(),
    attempt: z.number().int().nonnegative(),
    step: z.number().int().nullable(),
    kind: z.enum([
      "state",
      "draft",
      "action",
      "actionResolved",
      "attemptRestarted",
    ]),
    payload: z.unknown(),
    createdAt: z.string().datetime(),
  })
  .strict()
export const coachTaskStatusInputSchema = z
  .object({ taskId: coachTaskIdSchema })
  .strict()
export const coachTaskEventsInputSchema = coachTaskStatusInputSchema
  .extend({ after: coachTaskCursorSchema.default(-1) })
  .strict()
const coachTaskActionSchema = z
  .object({
    step: z.number().int().nonnegative(),
    slot: z.number().int().nonnegative(),
    toolCallId: z.string(),
    operation: z.string(),
    input: z.unknown(),
    state: z.enum([
      "planned",
      "proposed",
      "committed",
      "read",
      "denied",
      "stale",
      "failed",
      "cancelled",
    ]),
    proposalId: z.string().uuid().nullable(),
    activityId: z.string().uuid().nullable(),
    result: z.unknown(),
    errorCode: z.string().nullable(),
  })
  .strict()
const coachTaskConfirmationSchema = z
  .object({
    id: z.string().uuid(),
    command: z.string(),
    input: z.unknown(),
    summary: z.string(),
    status: z.enum(["pending", "approved", "denied", "expired"]),
    review: z.unknown().optional(),
  })
  .strict()
const coachTaskUsageSchema = z
  .object({
    id: z.string().uuid(),
    finishReason: z.string().nullable(),
    latencyMs: z.number().int().nullable(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheCreationInputTokens: z.number().int().nonnegative().default(0),
    cacheReadInputTokens: z.number().int().nonnegative().default(0),
  })
  .strict()
export const coachTaskSnapshotSchema = z
  .object({
    taskId: coachTaskIdSchema,
    chatId: idResult<ChatId>(),
    state: coachTaskStateSchema,
    sourceMessageId: z.string().uuid().nullable(),
    assistantMessageId: z.string().uuid().nullable(),
    supersedesMessageId: z.string().uuid().nullable(),
    cancelRequestedAt: z.string().datetime().nullable(),
    errorCode: coachTaskErrorCodeSchema.nullable(),
    cursor: coachTaskCursorSchema,
    events: coachTaskEventSchema.array(),
    messages: chatDetailSchema.shape.messages,
    actions: coachTaskActionSchema.array(),
    confirmations: coachTaskConfirmationSchema.array(),
    usage: coachTaskUsageSchema,
  })
  .strict()
const coachTaskResetSchema = z
  .object({
    type: z.literal("reset"),
    reason: z.enum(["expired", "gap", "ahead"]),
    snapshot: coachTaskSnapshotSchema,
  })
  .strict()
export const coachTaskReplaySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("events"),
      events: coachTaskEventSchema.array(),
      cursor: coachTaskCursorSchema,
      terminal: z.boolean(),
    })
    .strict(),
  coachTaskResetSchema,
])
export type CoachStartInput = z.infer<typeof coachStartInputSchema>
export type CoachTaskReplay = z.infer<typeof coachTaskReplaySchema>

export const coachTaskResource: ResourceRef = {
  name: "coach.task",
  coachFloor: "never",
}
