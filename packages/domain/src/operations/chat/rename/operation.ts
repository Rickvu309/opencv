import { chatRenameInputSchema, chatResource } from "../../../coach/chat.js"
import { chatDetailSchema } from "../../../coach/chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.rename",
  version: 1,
  kind: "command",
  description: "Rename a chat.",
  input: chatRenameInputSchema,
  publicResult: chatDetailSchema.strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [chatResource(input.chatId)],
})
