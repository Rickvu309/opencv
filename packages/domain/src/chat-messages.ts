import { z } from "zod"

import { applyStageSchema } from "./apply.js"
import { CHAT_MESSAGE_MAX, coachSelectionSchema } from "./chat.js"
export {
  COACH_SELECTION_TEXT_MAX,
  COACH_SELECTION_SECTION_ID_MAX,
  coachSelectionSchema,
} from "./chat.js"
import { coachModeSchema } from "./coach.js"
import { reversalDescriptorSchema } from "./commands.js"
import {
  paperContentKindSchema,
  paperDocIdSchema,
  paperDocStatusSchema,
} from "./paper.js"

// Stored on untitled chat rows and matched to detect them. Render titles
// through chatDisplayTitle.
export const DEFAULT_CHAT_TITLE = "New Thread"

export function chatDisplayTitle(title: string | null | undefined) {
  const trimmed = title?.trim() ?? ""
  return !trimmed || trimmed === DEFAULT_CHAT_TITLE ? "New chat" : trimmed
}

export const messageRoleSchema = z.enum(["user", "coach"])

export const chatMessageTextSchema = z
  .string()
  .trim()
  .min(1, "Message text is required")
  .max(CHAT_MESSAGE_MAX, "Message text is too long")

export const coachContextItemSchema = z
  .object({
    kind: z.enum(["paper", "job", "link", "file"]),
    id: z.string().trim().min(1).max(2000),
  })
  .strict()
export type CoachContextItem = z.infer<typeof coachContextItemSchema>

export type CoachSelection = z.infer<typeof coachSelectionSchema>

export const coachTurnRequestSchema = z
  .object({
    text: chatMessageTextSchema.optional(),
    mode: coachModeSchema.optional(),
    regenerate: z.literal(true).optional(),
    /**
     * Open Paper doc when the turn is sent from the editor AI panel.
     * `null` clears soft-scope for this turn (do not ground from the Chat).
     */
    focusDocId: paperDocIdSchema.nullish(),
    /** Highlighted Paper text when the User sends from the editor. */
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

export type MessageRole = z.infer<typeof messageRoleSchema>

export const chatMessageStatusSchema = z.enum(["final", "error", "aborted"])

export const chatTextPartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    selection: coachSelectionSchema.optional(),
  })
  .strict()

export const chatToolPartSchema = z
  .object({
    type: z.literal("tool"),
    name: z.string(),
    summary: z.string(),
    ok: z.boolean(),
    reversal: reversalDescriptorSchema.optional(),
    toolCallId: z.string().optional(),
    /** The activity row the command wrote; `activity.undo` takes this id. */
    activityId: z.string().optional(),
    pendingActionId: z.string().optional(),
    approval: z.enum(["pending", "approved", "denied", "expired"]).optional(),
    /** Set after a successful one-click undo of this receipt. */
    undone: z.boolean().optional(),
    /** Per-command scan payload for the three rich receipts. */
    detail: coachReceiptDetailSchema.optional(),
  })
  .strict()

export const chatEntryPartSchema = z.discriminatedUnion("type", [
  chatTextPartSchema,
  chatToolPartSchema,
])

export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>
export type ChatTextPart = z.infer<typeof chatTextPartSchema>
export type ChatToolPart = z.infer<typeof chatToolPartSchema>
export type ChatEntryPart = z.infer<typeof chatEntryPartSchema>

/** Concatenate text parts in order. `text` on the row stays this value. */
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
  /** Persisted Paper grounding; null for Home-only Chats. */
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
