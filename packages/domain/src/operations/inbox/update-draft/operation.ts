import { z } from "zod"
import {
  draftOutput,
  inboxThreadResource,
  threadIdSchema,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.updateDraft",
  version: 1,
  kind: "command",
  description: "Save an edited reply.",
  input: z
    .object({ threadId: threadIdSchema, body: z.string().max(20_000) })
    .strict(),
  publicResult: draftOutput,
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
