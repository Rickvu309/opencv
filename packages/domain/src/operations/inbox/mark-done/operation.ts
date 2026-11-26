import { z } from "zod"
import {
  inboxStatusSchema,
  inboxThreadResource,
  threadIdSchema,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.markDone",
  version: 1,
  kind: "command",
  description: "Mark an email done.",
  label: "Mark this message done",
  input: z
    .object({
      threadId: threadIdSchema,
      status: inboxStatusSchema.optional(),
    })
    .strict(),
  publicResult: z.object({ id: z.string() }).strip(),
  coach: "auto",
  coachPermission: "agentEmail",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
