import { z } from "zod"
import { chatResource } from "../../../chat.js"
import { chatListSchema } from "../../../chat-views.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.list",
  version: 1,
  kind: "read",
  description: "List chats.",
  input: z.object({ query: z.string().optional() }).strict(),
  publicResult: chatListSchema,
  coach: "auto",
  dependsOn: () => [chatResource()],
})
