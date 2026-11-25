import { z } from "zod"
import { chatResource } from "../../../chat.js"
import { chatDetailSchema } from "../../../chat-views.js"
import { defineOperation } from "../../../operation.js"
import { chatIdSchema } from "../../../ids.js"

export const operation = defineOperation({
  owner: "coach",
  name: "chat.get",
  version: 1,
  kind: "read",
  description: "Read one chat.",
  input: z.object({ chatId: chatIdSchema }).strict(),
  publicResult: chatDetailSchema,
  coach: "auto",
  dependsOn: (input) => [chatResource(input.chatId)],
})
