import { z } from "zod"

import {
  chatAppendMessageInputSchema,
  chatCreateInputSchema,
  chatDeleteInputSchema,
  chatFocusSchema,
  chatOpenInputSchema,
  chatRenameInputSchema,
  chatSetFocusInputSchema,
} from "./chat.js"
import { commandContract, commandEntry } from "./contract.js"
import type { ChatId } from "./ids.js"
import type { QueryRef } from "./queries.js"
import { chatDetailSchema } from "./chat-views.js"

const chatList = (): QueryRef[] => [{ query: "chat.list" }]
const chatChanged = (input: { chatId: ChatId }): QueryRef[] => [
  { query: "chat.list" },
  { query: "chat.get", input: { chatId: input.chatId } },
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
})

export type ChatContract = typeof chatContract
