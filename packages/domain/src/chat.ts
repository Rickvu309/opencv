import { z } from "zod"

import { activityIdSchema, chatIdSchema, pendingActionIdSchema } from "./ids.js"

export const CHAT_TITLE_MAX = 200
export const CHAT_MESSAGE_MAX = 8000
export const CHAT_OPEN_WINDOW_DAYS = 7

export const focusKindSchema = z.enum(["paper", "job", "inbox"])
export type FocusKind = z.infer<typeof focusKindSchema>

export const chatFocusSchema = z
  .object({
    kind: focusKindSchema,
    id: z.string().uuid(),
  })
  .strict()

export type ChatFocus = z.infer<typeof chatFocusSchema>

const titleSchema = z.string().trim().min(1).max(CHAT_TITLE_MAX)

export const chatCreateInputSchema = z
  .object({
    title: titleSchema.optional(),
  })
  .strict()

export const chatRenameInputSchema = z
  .object({
    chatId: chatIdSchema,
    title: titleSchema,
  })
  .strict()

export const chatOpenInputSchema = z
  .object({
    focus: chatFocusSchema.optional(),
  })
  .strict()

export const chatSetFocusInputSchema = z
  .object({
    chatId: chatIdSchema,
    focus: chatFocusSchema.nullable(),
  })
  .strict()

export const chatAttachmentSchema = z
  .object({
    kind: z.enum(["paper", "job", "file", "link"]),
    id: z.string().min(1).max(2000),
    label: z.string().max(200).optional(),
  })
  .strict()

export type ChatAttachment = z.infer<typeof chatAttachmentSchema>

export const chatAppendMessageInputSchema = z
  .object({
    chatId: chatIdSchema,
    text: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
    attachments: z.array(chatAttachmentSchema).max(8).optional(),
  })
  .strict()

export const chatDeleteInputSchema = z
  .object({
    chatId: chatIdSchema,
  })
  .strict()

export const chatStopInputSchema = z
  .object({
    chatId: chatIdSchema,
  })
  .strict()

export type ChatCreateInput = z.infer<typeof chatCreateInputSchema>
export type ChatRenameInput = z.infer<typeof chatRenameInputSchema>
export type ChatOpenInput = z.infer<typeof chatOpenInputSchema>
export type ChatSetFocusInput = z.infer<typeof chatSetFocusInputSchema>
export type ChatAppendMessageInput = z.infer<
  typeof chatAppendMessageInputSchema
>
export type ChatDeleteInput = z.infer<typeof chatDeleteInputSchema>
export type ChatStopInput = z.infer<typeof chatStopInputSchema>

export const actionsApproveInputSchema = z
  .object({
    pendingActionId: pendingActionIdSchema,
  })
  .strict()

export const actionsDenyInputSchema = actionsApproveInputSchema

export const activityUndoInputSchema = z
  .object({
    activityId: activityIdSchema,
  })
  .strict()

export type ActionsApproveInput = z.infer<typeof actionsApproveInputSchema>
export type ActionsDenyInput = z.infer<typeof actionsDenyInputSchema>
export type ActivityUndoInput = z.infer<typeof activityUndoInputSchema>

export type ChatTurnEvent =
  | { type: "message-start"; chatId: string }
  | { type: "text-delta"; text: string }
  | { type: "step"; label: string }
  | {
      type: "tool-call"
      toolCallId: string
      name: string
      input: unknown
    }
  | {
      type: "tool-result"
      toolCallId: string
      name: string
      summary: string
      ok: boolean
      activityId?: string
    }
  | {
      type: "confirm"
      pendingActionId: string
      command: string
      summary: string
    }
  | { type: "usage"; plan: string; mode: string; capped: boolean }
  | { type: "message-end" }
  | { type: "error"; message: string }

export function focusedEditNeedsReplace(input: {
  mode: string
  focusKind: string | null
  askedForEdit: boolean
  calledReplace: boolean
}) {
  return (
    input.mode === "free" &&
    input.focusKind === "paper" &&
    input.askedForEdit &&
    !input.calledReplace
  )
}
