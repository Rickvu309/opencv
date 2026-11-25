import { z } from "zod"
import { inboxThreadResource, threadIdSchema } from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.addToCalendar",
  version: 1,
  kind: "command",
  description: "Add the selected time to the calendar.",
  input: z
    .object({ threadId: threadIdSchema, start: z.string().datetime() })
    .strict(),
  publicResult: z
    .object({
      id: z.string(),
      threadId: z.string(),
      start: z.string().datetime(),
    })
    .strict(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
