import { z } from "zod"

import { chatIdSchema } from "./ids.js"

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

export const CHAT_TITLE_MAX = 200
export const CHAT_MESSAGE_MAX = 8000
export const CHAT_OPEN_WINDOW_DAYS = 7

export const focusKindSchema = z.enum(["paper", "job", "inbox"])

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
    blockIds: z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/))
      .max(50)
      .optional(),
  })
  .strict()

export const chatAppendMessageInputSchema = z
  .object({
    chatId: chatIdSchema,
    text: z.string().trim().min(1).max(CHAT_MESSAGE_MAX),
    attachments: z.array(chatAttachmentSchema).max(8).optional(),
    selection: coachSelectionSchema.optional(),
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
    taskId: z.string().uuid().optional(),
  })
  .strict()

export type ChatOpenInput = z.infer<typeof chatOpenInputSchema>
export type ChatSetFocusInput = z.infer<typeof chatSetFocusInputSchema>
export type ChatAppendMessageInput = z.infer<
  typeof chatAppendMessageInputSchema
>

export function focusedEditNeedsPaperEdit(input: {
  mode: string
  focusKind: string | null
  askedForEdit: boolean
  calledEdit: boolean
}) {
  return (
    input.mode === "free" &&
    input.focusKind === "paper" &&
    input.askedForEdit &&
    !input.calledEdit
  )
}
