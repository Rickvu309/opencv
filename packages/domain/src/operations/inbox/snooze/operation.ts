import { z } from "zod"
import { inboxThreadResource, threadIdSchema } from "../../../inbox.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.snooze",
  version: 1,
  kind: "command",
  description: "Snooze an email until a time.",
  input: z
    .object({
      threadId: threadIdSchema,
      until: z.string().datetime().nullable(),
    })
    .strict(),
  publicResult: z.object({ id: z.string() }).strip(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
