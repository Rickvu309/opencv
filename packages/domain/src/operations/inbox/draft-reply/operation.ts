import { z } from "zod"
import {
  draftOutput,
  inboxThreadResource,
  threadIdSchema,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.draftReply",
  version: 1,
  kind: "command",
  description: "Draft a reply. A hint asks the Coach for another one.",
  input: z
    .object({
      threadId: threadIdSchema,
      hint: z.string().trim().min(1).max(8000).optional(),
    })
    .strict(),
  publicResult: draftOutput,
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
