import {
  emptyInboxInput,
  inboxListSchema,
  inboxThreadResource,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.list",
  version: 1,
  kind: "read",
  description: "List email threads.",
  label: "Look at your Inbox",
  readLabel: "Looked at your Inbox",
  input: emptyInboxInput,
  publicResult: inboxListSchema,
  coach: "never",
  dependsOn: () => [inboxThreadResource()],
})
