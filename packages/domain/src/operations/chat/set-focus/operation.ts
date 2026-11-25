import { chatResource, chatSetFocusInputSchema } from "../../../chat.js"
import { chatDetailSchema } from "../../../chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.setFocus",
  version: 1,
  kind: "command",
  description: "Point a chat at a document, job, or inbox thread.",
  input: chatSetFocusInputSchema,
  publicResult: chatDetailSchema.strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [chatResource(input.chatId)],
})
