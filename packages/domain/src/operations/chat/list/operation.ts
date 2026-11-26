import { z } from "zod"
import { chatResource } from "../../../coach/chat.js"
import { chatListSchema } from "../../../coach/chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.list",
  version: 1,
  kind: "read",
  description: "List chats.",
  label: "Look at your Chats",
  readLabel: "Looked at your Chats",
  input: z.object({ query: z.string().optional() }).strict(),
  publicResult: chatListSchema,
  coach: "auto",
  dependsOn: () => [chatResource()],
})
