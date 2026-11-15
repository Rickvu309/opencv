import { z } from "zod"

import {
  actionsApproveInputSchema,
  actionsDenyInputSchema,
  activityUndoInputSchema,
  chatAppendMessageInputSchema,
  chatAttachmentSchema,
  chatCreateInputSchema,
  chatDeleteInputSchema,
  chatFocusSchema,
  chatOpenInputSchema,
  chatRenameInputSchema,
  chatSetFocusInputSchema,
  chatStopInputSchema,
  focusKindSchema,
} from "./chat.js"
import { commandContract, commandEntry } from "./contract.js"
import type { ChatId } from "./ids.js"
import type { QueryRef } from "./queries.js"
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

const chatList = (): QueryRef[] => [{ query: "chat.list" }]
const chatChanged = (input: { chatId: ChatId }): QueryRef[] => [
  { query: "chat.list" },
  { query: "chat.get", input: { chatId: input.chatId } },
]

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

export const chatContract = commandContract({
  "chat.create": commandEntry({
    description: "Start a chat.",
    input: chatCreateInputSchema,
    output: chatDetailSchema,
    coach: "never",
    destructive: false,
    step: () => "Start a chat",
    invalidates: chatList,
  }),
  "chat.rename": commandEntry({
    description: "Rename a chat.",
    input: chatRenameInputSchema,
    output: chatDetailSchema.extend({ previousTitle: z.string() }).strict(),
    coach: "auto",
    destructive: false,
    step: () => "Rename the chat",
    invalidates: chatChanged,
  }),
  "chat.open": commandEntry({
    description: "Open a chat for a focus, reusing a recent one.",
    input: chatOpenInputSchema,
    output: chatDetailSchema,
    coach: "never",
    destructive: false,
    step: () => "Open a chat",
    invalidates: chatList,
  }),
  "chat.setFocus": commandEntry({
    description: "Point a chat at a document, job, or inbox thread.",
    input: chatSetFocusInputSchema,
    output: chatDetailSchema
      .extend({ previousFocus: chatFocusSchema.nullable() })
      .strict(),
    coach: "auto",
    destructive: false,
    step: () => "Set the chat focus",
    invalidates: chatChanged,
  }),
  "chat.appendMessage": commandEntry({
    description:
      "Append the person's message. The Coach does not post as the person.",
    input: chatAppendMessageInputSchema,
    output: chatDetailSchema,
    coach: "never",
    destructive: false,
    step: () => "Send a message",
    invalidates: chatChanged,
  }),
  "chat.delete": commandEntry({
    description: "Delete a chat and its messages.",
    input: chatDeleteInputSchema,
    output: z.object({ id: z.string() }).strict(),
    coach: "confirm",
    destructive: true,
    step: () => "Delete this chat",
    invalidates: chatChanged,
  }),
  "coach.stop": commandEntry({
    description: "Stop the chat that is running.",
    input: chatStopInputSchema,
    output: z.object({ stopped: z.boolean() }).strict(),
    coach: "never",
    destructive: false,
    step: () => "Stop",
    invalidates: () => [],
  }),
  "actions.approve": commandEntry({
    description: "Run a pending Coach action.",
    input: actionsApproveInputSchema,
    output: activityRowAsTheApiReturnsIt.nullable(),
    coach: "never",
    destructive: false,
    step: () => "Approve",
    invalidates: readsAnUndoOrApprovalCanChange,
  }),
  "actions.deny": commandEntry({
    description: "Decline a pending Coach action.",
    input: actionsDenyInputSchema,
    output: pendingActionRowSchema,
    coach: "never",
    destructive: false,
    step: () => "Decline",
    invalidates: () => [],
  }),
  "activity.undo": commandEntry({
    description: "Undo one activity row.",
    input: activityUndoInputSchema,
    output: activityRowAsTheApiReturnsIt,
    coach: "never",
    destructive: false,
    step: () => "Undo",
    invalidates: readsAnUndoOrApprovalCanChange,
  }),
})

export type ChatContract = typeof chatContract
