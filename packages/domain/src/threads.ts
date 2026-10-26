import { z } from "zod"

import { applyStageSchema } from "./apply.js"
import { coachModeSchema, type CoachUsageRating } from "./coach.js"
import { reversalDescriptorSchema, THREAD_COMMANDS } from "./commands.js"
import {
  paperContentKindSchema,
  paperDocIdSchema,
  paperDocStatusSchema,
} from "./paper.js"

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
    /** Open Paper doc this Thread is grounded on, when created from Paper. */
    focusDocId: paperDocIdSchema.optional(),
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

export const COACH_SELECTION_TEXT_MAX = 2000
export const COACH_SELECTION_SECTION_ID_MAX = 80

export const coachSelectionSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Selection text is required")
      .max(COACH_SELECTION_TEXT_MAX, "Selection is too long"),
    sectionId: z
      .string()
      .trim()
      .min(1)
      .max(COACH_SELECTION_SECTION_ID_MAX)
      .optional(),
  })
  .strict()

export type CoachSelection = z.infer<typeof coachSelectionSchema>

export const coachTurnRequestSchema = z
  .object({
    text: threadMessageTextSchema.optional(),
    mode: coachModeSchema.optional(),
    regenerate: z.literal(true).optional(),
    /**
     * Open Paper doc when the turn is sent from the editor AI panel.
     * `null` clears soft-scope for this turn (do not ground from the Thread).
     */
    focusDocId: paperDocIdSchema.nullish(),
    /** Highlighted Paper text when the User sends from the editor. */
    selection: coachSelectionSchema.optional(),
    context: z
      .array(
        z
          .object({
            kind: z.enum(["paper", "job", "link", "file"]),
            id: z.string().trim().min(1).max(2000),
          })
          .strict()
      )
      .max(8)
      .optional(),
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

const receiptDiffLineSchema = z
  .object({
    kind: z.enum(["eq", "del", "add"]),
    text: z.string(),
  })
  .strict()

const receiptDiffHunkSchema = z
  .object({
    section: z.string(),
    sectionId: z.string(),
    lines: z.array(receiptDiffLineSchema),
  })
  .strict()

export const coachReceiptDetailSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("paper.updateContent"),
      docKind: paperContentKindSchema,
      docName: z.string(),
      hunks: z.array(receiptDiffHunkSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("apply.moveCard"),
      title: z.string(),
      company: z.string(),
      from: applyStageSchema,
      to: applyStageSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("paper.createDoc"),
      docKind: paperContentKindSchema,
      name: z.string(),
      status: paperDocStatusSchema,
    })
    .strict(),
])

export type CoachReceiptDetail = z.infer<typeof coachReceiptDetailSchema>

export const coachReverseRequestSchema = z
  .object({
    toolCallId: z.string().min(1),
  })
  .strict()

export type CoachReverseRequest = z.infer<typeof coachReverseRequestSchema>

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
    /** Set after a successful one-click undo of this receipt. */
    undone: z.boolean().optional(),
    /** Per-command scan payload for the three rich receipts. */
    detail: coachReceiptDetailSchema.optional(),
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
  /** Persisted Paper grounding; null for Home-only Threads. */
  focusDocId: string | null
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

export type CoachReverseResult = {
  thread: ThreadDetail
  receipt: ThreadToolPart
}

/** Whether a persisted receipt can run its reversal Command. */
export function canReverseReceipt(
  part: ThreadToolPart
): part is ThreadToolPart & {
  reversal: {
    possible: true
    description: string
    command: string
    input: unknown
  }
} {
  return (
    part.ok &&
    part.reversal?.possible === true &&
    part.undone !== true &&
    typeof part.reversal.command === "string" &&
    part.reversal.command.length > 0 &&
    part.reversal.input !== undefined
  )
}
