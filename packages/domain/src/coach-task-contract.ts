import { z } from "zod"
import { coachTurnRequestSchema } from "./chat-messages.js"
import { chatStopInputSchema } from "./chat.js"
import { chatDetailSchema } from "./chat-contract.js"
import { chatIdSchema } from "./ids.js"
import {
  commandContract,
  commandEntry,
  queryContract,
  queryEntry,
} from "./contract.js"

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
const coachStartInputSchema = coachTurnRequestSchema.safeExtend({
  chatId: chatIdSchema,
  startKey: z.string().uuid(),
})
const coachStartReceiptSchema = z
  .object({
    taskId: coachTaskIdSchema,
    chatId: chatIdSchema,
    acceptedAt: z.string().datetime(),
  })
  .strict()
export const coachStartOutputSchema = z
  .object({
    taskId: coachTaskIdSchema,
    chatId: chatIdSchema,
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
    chatId: chatIdSchema,
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
const coachTaskReplaySchema = z.discriminatedUnion("type", [
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

export const coachTaskContract = commandContract({
  "coach.stop": commandEntry({
    description: "Stop the chat that is running.",
    input: chatStopInputSchema,
    output: z.object({ stopped: z.boolean() }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Stop",
    invalidates: () => [],
  }),
  "coach.start": commandEntry({
    description: "Queue a durable Coach task.",
    input: coachStartInputSchema,
    output: coachStartOutputSchema,
    idempotency: "none",
    coach: "never",
    destructive: false,
    step: () => "Start Coach",
    invalidates: (input) => [
      { query: "chat.get", input: { chatId: input.chatId } },
      { query: "chat.list" },
      { query: "coach.usage" },
    ],
  }),
})
export const coachTaskQueries = queryContract({
  "coach.status": queryEntry({
    input: coachTaskStatusInputSchema,
    output: coachTaskSnapshotSchema,
  }),
  "coach.events": queryEntry({
    input: coachTaskEventsInputSchema,
    output: coachTaskReplaySchema,
  }),
})
