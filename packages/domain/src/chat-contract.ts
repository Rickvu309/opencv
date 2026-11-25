import { z } from "zod"

import {
  chatFocusSchema,
  chatRenameInputSchema,
  chatSetFocusInputSchema,
} from "./chat.js"
import { commandContract, commandEntry } from "./contract.js"
import type { ChatId } from "./ids.js"
import type { QueryRef } from "./queries.js"
import { chatDetailSchema } from "./chat-views.js"

const chatChanged = (input: { chatId: ChatId }): QueryRef[] => [
  { query: "chat.list" },
  { query: "chat.get", input: { chatId: input.chatId } },
]

export const chatContract = commandContract({
  "chat.rename": commandEntry({
    description: "Rename a chat.",
    input: chatRenameInputSchema,
    output: chatDetailSchema.extend({ previousTitle: z.string() }).strict(),
    coach: "auto",
    destructive: false,
    step: () => "Rename the chat",
    invalidates: chatChanged,
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
})

export type ChatContract = typeof chatContract
