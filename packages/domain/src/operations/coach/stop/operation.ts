import { z } from "zod"
import { chatStopInputSchema } from "../../../chat.js"
import { coachTaskResource } from "../../../coach/coach-task.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "coach",
  name: "coach.stop",
  version: 1,
  kind: "command",
  description: "Stop the chat that is running.",
  input: chatStopInputSchema,
  publicResult: z.object({ stopped: z.boolean() }).strict(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: () => [coachTaskResource],
})
