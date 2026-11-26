import { z } from "zod"
import { chatDeleteInputSchema, chatResource } from "../../../coach/chat.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.delete",
  version: 1,
  kind: "command",
  description: "Delete a chat and its messages.",
  label: "Delete this Chat",
  input: chatDeleteInputSchema,
  publicResult: z.object({ id: z.string() }).strict(),
  coach: "confirm",
  destructive: true,
  idempotency: "keyed",
  writes: (input) => [chatResource(input.chatId)],
})
