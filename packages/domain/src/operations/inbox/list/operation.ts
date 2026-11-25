import {
  emptyInboxInput,
  inboxListSchema,
  inboxThreadResource,
} from "../../../inbox.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.list",
  version: 1,
  kind: "read",
  description: "List email threads.",
  input: emptyInboxInput,
  publicResult: inboxListSchema,
  coach: "never",
  dependsOn: () => [inboxThreadResource()],
})
