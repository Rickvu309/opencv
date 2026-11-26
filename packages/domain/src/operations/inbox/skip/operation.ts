import { z } from "zod"
import { profileResource } from "../../../account/account.js"
import { emptyInboxInput, inboxThreadResource } from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.skip",
  version: 1,
  kind: "command",
  description: "Skip Gmail for now.",
  label: "Skip this message",
  input: emptyInboxInput,
  publicResult: z.object({ skipped: z.literal(true) }).strict(),
  coach: "never",
  coachPermission: "agentEmail",
  destructive: false,
  idempotency: "keyed",
  writes: () => [inboxThreadResource(), profileResource],
})
