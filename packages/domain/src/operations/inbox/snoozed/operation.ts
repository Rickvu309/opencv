import {
  emptyInboxInput,
  inboxListSchema,
  inboxThreadResource,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.snoozed",
  version: 1,
  kind: "read",
  description: "List snoozed email threads.",
  label: "Look at snoozed messages",
  readLabel: "Looked at snoozed messages",
  input: emptyInboxInput,
  publicResult: inboxListSchema,
  coach: "never",
  dependsOn: () => [inboxThreadResource()],
})
