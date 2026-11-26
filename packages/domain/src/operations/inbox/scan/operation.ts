import { z } from "zod"
import {
  emptyInboxInput,
  inboxThreadResource,
  inboxThreadSchema,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.scan",
  version: 1,
  kind: "command",
  description: "Read job emails from the mail provider.",
  label: "Check your Inbox",
  input: emptyInboxInput,
  publicResult: z
    .object({
      threads: z.array(inboxThreadSchema),
      emailCount: z.number().int(),
      companyCount: z.number().int(),
    })
    .strict(),
  coach: "auto",
  destructive: false,
  idempotency: "keyed",
  writes: () => [inboxThreadResource()],
})
