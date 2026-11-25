import {
  emptyInboxInput,
  inboxListSchema,
  inboxThreadResource,
} from "../../../inbox.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.snoozed",
  version: 1,
  kind: "read",
  description: "List snoozed email threads.",
  input: emptyInboxInput,
  publicResult: inboxListSchema,
  coach: "never",
  dependsOn: () => [inboxThreadResource()],
})
