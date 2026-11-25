import { chatCreateInputSchema, chatResource } from "../../../coach/chat.js"
import { chatDetailSchema } from "../../../coach/chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.create",
  version: 1,
  kind: "command",
  description: "Start a chat.",
  input: chatCreateInputSchema,
  publicResult: chatDetailSchema,
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [chatResource()],
})
