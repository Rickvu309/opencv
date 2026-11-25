import { z } from "zod"
import { inboxThreadResource, threadInput } from "../../../inbox.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.clearSuggestion",
  version: 1,
  kind: "command",
  description: "Dismiss a stage suggestion.",
  input: threadInput,
  publicResult: z.object({ id: z.string() }).strip(),
  coach: "never",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
