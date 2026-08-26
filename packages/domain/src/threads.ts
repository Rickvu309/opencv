import { z } from "zod"

import { coachModeSchema, type CoachUsageRating } from "./coach.js"
import { reversalDescriptorSchema, THREAD_COMMANDS } from "./commands.js"
import { paperDocIdSchema } from "./paper.js"

export { THREAD_COMMANDS }

export const DEFAULT_THREAD_TITLE = "New Thread"

export const THREAD_TITLE_MAX = 200
export const THREAD_MESSAGE_MAX = 8000

export const messageRoleSchema = z.enum(["user", "coach"])

export const threadIdSchema = z.string().uuid()

export const threadMessageIdSchema = z.string().uuid()

export const threadTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(THREAD_TITLE_MAX, "Title is too long")

export const threadMessageTextSchema = z
  .string()
  .trim()
  .min(1, "Message text is required")
  .max(THREAD_MESSAGE_MAX, "Message text is too long")

export const threadsCreateInputSchema = z
  .object({
    title: threadTitleSchema.optional(),
  })
  .strict()

export const threadsRenameInputSchema = z
  .object({
    threadId: threadIdSchema,
    title: threadTitleSchema,
  })
  .strict()

export const threadsDeleteInputSchema = z
  .object({
    threadId: threadIdSchema,
  })
  .strict()

export const threadsPostMessageInputSchema = z
  .object({
    threadId: threadIdSchema,
    text: threadMessageTextSchema,
  })
  .strict()

export type ThreadsCreateInput = z.infer<typeof threadsCreateInputSchema>
export type ThreadsRenameInput = z.infer<typeof threadsRenameInputSchema>
export type ThreadsDeleteInput = z.infer<typeof threadsDeleteInputSchema>
export type ThreadsPostMessageInput = z.infer<
  typeof threadsPostMessageInputSchema
>

export const coachTurnRequestSchema = z
  .object({
    text: threadMessageTextSchema.optional(),
    mode: coachModeSchema.optional(),
    regenerate: z.literal(true).optional(),
    /** Open Paper doc when the turn is sent from the editor AI panel. */
    focusDocId: paperDocIdSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.regenerate) return
    if (value.text == null) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: "Message text is required",
      })
    }
  })

export type CoachTurnRequest = z.infer<typeof coachTurnRequestSchema>

export type MessageRole = z.infer<typeof messageRoleSchema>

export const threadMessageStatusSchema = z.enum(["final", "error", "aborted"])

export const threadTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .strict()

export const threadToolPartSchema = z
  .object({
    type: z.literal("tool"),
    name: z.string(),
    summary: z.string(),
    ok: z.boolean(),
    reversal: reversalDescriptorSchema.optional(),
    toolCallId: z.string().optional(),
  })
  .strict()

export const threadMessagePartSchema = z.discriminatedUnion("type", [
  threadTextPartSchema,
  threadToolPartSchema,
])

export type ThreadMessageStatus = z.infer<typeof threadMessageStatusSchema>
export type ThreadTextPart = z.infer<typeof threadTextPartSchema>
export type ThreadToolPart = z.infer<typeof threadToolPartSchema>
export type ThreadMessagePart = z.infer<typeof threadMessagePartSchema>

/** Concatenate text parts in order. `text` on the row stays this value. */
export function textFromParts(parts: readonly ThreadMessagePart[]): string {
  return parts
    .filter((part): part is ThreadTextPart => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export type ThreadListItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type ThreadMessage = {
  id: string
  role: MessageRole
  text: string
  createdAt: string
  parts?: ThreadMessagePart[]
  status?: ThreadMessageStatus
  workedMs?: number
  /** Present when a `coach_usage` row exists for this message. */
  rating?: CoachUsageRating | null
}

export type ThreadDetail = ThreadListItem & {
  messages: ThreadMessage[]
}

export type ThreadDeleted = {
  id: string
}
