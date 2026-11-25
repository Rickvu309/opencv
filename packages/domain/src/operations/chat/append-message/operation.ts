import {
  chatAppendMessageInputSchema,
  chatResource,
} from "../../../coach/chat.js"
import { chatDetailSchema } from "../../../coach/chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.appendMessage",
  version: 1,
  kind: "command",
  description:
    "Append the person's message. The Coach does not post as the person.",
  input: chatAppendMessageInputSchema,
  publicResult: chatDetailSchema,
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [chatResource(input.chatId)],
})
