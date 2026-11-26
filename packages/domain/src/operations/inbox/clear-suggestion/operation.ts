import { z } from "zod"
import { inboxThreadResource, threadInput } from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.clearSuggestion",
  version: 1,
  kind: "command",
  description: "Dismiss a stage suggestion.",
  label: "Clear this suggestion",
  input: threadInput,
  publicResult: z.object({ id: z.string() }).strip(),
  coach: "never",
  coachPermission: "agentEmail",
  destructive: false,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
