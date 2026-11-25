import { z } from "zod"

import { chatAttachmentSchema, focusKindSchema } from "./chat.js"
import {
  chatMessageStatusSchema,
  chatTextPartSchema,
  chatToolPartSchema,
} from "./chat-messages.js"

const chatAttachmentPartSchema = chatAttachmentSchema.extend({
  type: z.literal("attachment"),
})

export const chatMessagePartSchema = z.discriminatedUnion("type", [
  chatTextPartSchema,
  chatToolPartSchema,
  chatAttachmentPartSchema,
])

export type ChatMessagePart = z.output<typeof chatMessagePartSchema>

const chatListItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    focusKind: focusKindSchema.nullable(),
    focusId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type ChatListItem = z.output<typeof chatListItemSchema>

const chatMessageSchema = z
  .object({
    id: z.string(),
    chatId: z.string(),
    role: z.enum(["person", "coach", "delegate"]),
    text: z.string(),
    parts: z.array(chatMessagePartSchema),
    status: chatMessageStatusSchema.nullable(),
    workedMs: z.number().int().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict()

export type ChatMessage = z.output<typeof chatMessageSchema>

export const chatDetailSchema = chatListItemSchema
  .extend({
    messages: z.array(chatMessageSchema),
    activeTaskId: z.string().uuid().nullable().optional(),
  })
  .strict()

export type ChatDetail = z.output<typeof chatDetailSchema>

export const chatListSchema = z.array(chatListItemSchema)
