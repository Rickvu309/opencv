import { chatOpenInputSchema, chatResource } from "../../../chat.js"
import { chatDetailSchema } from "../../../chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.open",
  version: 1,
  kind: "command",
  description: "Open a chat for a focus, reusing a recent one.",
  input: chatOpenInputSchema,
  publicResult: chatDetailSchema,
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [chatResource()],
})
