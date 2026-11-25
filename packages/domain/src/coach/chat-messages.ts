import { z } from "zod"

import { applyStageSchema } from "../apply/job-posting.js"
import { CHAT_MESSAGE_MAX, coachSelectionSchema } from "./chat.js"
export {
  COACH_SELECTION_TEXT_MAX,
  COACH_SELECTION_SECTION_ID_MAX,
  coachSelectionSchema,
} from "./chat.js"
import { coachModeSchema } from "./coach-mode.js"
import {
  paperContentKindSchema,
  paperDocIdSchema,
  paperDocStatusSchema,
} from "../paper-doc/paper.js"

export const reversalDescriptorSchema = z.object({
  possible: z.boolean(),
  description: z.string(),
  command: z.string().optional(),
  input: z.unknown().optional(),
})

export type ReversalDescriptor = z.infer<typeof reversalDescriptorSchema>

export const DEFAULT_CHAT_TITLE = "New chat"
export const LEGACY_CHAT_TITLE = "New Thread"

export function chatDisplayTitle(title: string | null | undefined) {
  const trimmed = title?.trim() ?? ""
  return !trimmed ||
    trimmed === DEFAULT_CHAT_TITLE ||
    trimmed === LEGACY_CHAT_TITLE
    ? "New chat"
    : trimmed
}

const chatMessageTextSchema = z
  .string()
  .trim()
  .min(1, "Message text is required")
  .max(CHAT_MESSAGE_MAX, "Message text is too long")

const coachContextItemSchema = z
  .object({
    kind: z.enum(["paper", "job", "link", "file"]),
    id: z.string().trim().min(1).max(2000),
    blockIds: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
      .max(50)
      .optional(),
  })
  .strict()
export type CoachContextItem = z.infer<typeof coachContextItemSchema>

export type CoachSelection = z.infer<typeof coachSelectionSchema>

export const coachTurnRequestSchema = z
  .object({
    text: chatMessageTextSchema.optional(),
    mode: coachModeSchema.optional(),
    regenerate: z.literal(true).optional(),
    textOnly: z.literal(true).optional(),
    focusDocId: paperDocIdSchema.nullish(),
    selection: coachSelectionSchema.optional(),
    context: z.array(coachContextItemSchema).max(8).optional(),
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
      type: z.literal("paper.replace"),
      docId: z.string().optional(),
      docKind: paperContentKindSchema,
      docName: z.string(),
      hunks: z.array(receiptDiffHunkSchema),
    })
    .strict(),
  z
    .object({
      type: z.literal("job.move"),
      title: z.string(),
      company: z.string(),
      from: applyStageSchema,
      to: applyStageSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("paper.create"),
      docId: z.string().optional(),
      docKind: paperContentKindSchema,
      name: z.string(),
      status: paperDocStatusSchema,
    })
    .strict(),
])

export type CoachReceiptDetail = z.infer<typeof coachReceiptDetailSchema>

type MessageRole = "user" | "coach"

export const chatMessageStatusSchema = z.enum(["final", "error", "aborted"])

export const chatTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    selection: coachSelectionSchema.optional(),
  })
  .strict()

const chatToolOutcomeSchema = z.enum([
  "waiting",
  "approved",
  "denied",
  "failed",
  "undone",
  "expired",
  "stopped",
])

export type ChatToolOutcome = z.infer<typeof chatToolOutcomeSchema>

export const chatToolPartSchema = z
  .object({
    type: z.literal("tool"),
    name: z.string(),
    summary: z.string(),
    ok: z.boolean(),
    reversal: reversalDescriptorSchema.optional(),
    toolCallId: z.string().optional(),
    activityId: z.string().optional(),
    pendingActionId: z.string().optional(),
    approval: z
      .enum(["pending", "approved", "denied", "expired", "stopped"])
      .optional(),
    outcome: chatToolOutcomeSchema.optional(),
    undone: z.boolean().optional(),
    detail: coachReceiptDetailSchema.optional(),
    review: z.unknown().optional(),
  })
  .strict()

export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>
type ChatTextPart = z.infer<typeof chatTextPartSchema>
export type ChatToolPart = z.infer<typeof chatToolPartSchema>
export type ChatEntryPart = ChatTextPart | ChatToolPart

export function textFromParts(parts: readonly ChatEntryPart[]): string {
  return parts
    .filter((part): part is ChatTextPart => part.type === "text")
    .map((part) => part.text)
    .join("")
}

export type ChatSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  focusDocId: string | null
}

export type ChatEntry = {
  id: string
  role: MessageRole
  text: string
  createdAt: string
  parts?: ChatEntryPart[]
  status?: ChatMessageStatus
  workedMs?: number
}

export type ChatRecord = ChatSummary & {
  messages: ChatEntry[]
}
