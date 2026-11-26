import { z } from "zod"
import { inboxThreadResource, threadInput } from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.send",
  version: 1,
  kind: "command",
  description: "Send the drafted reply.",
  label: "Send your reply",
  input: threadInput,
  publicResult: z
    .object({ id: z.string(), threadId: z.string(), body: z.string() })
    .strict(),
  coach: "never",
  coachPermission: "agentEmail",
  destructive: true,
  idempotency: "keyed",
  writes: (input) => [inboxThreadResource(input.threadId)],
})
