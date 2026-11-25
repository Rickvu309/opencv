import {
  inboxDetailSchema,
  inboxThreadResource,
  threadInput,
} from "../../../inbox.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.get",
  version: 1,
  kind: "read",
  description: "Read one email thread.",
  input: threadInput,
  publicResult: inboxDetailSchema,
  coach: "never",
  dependsOn: (input) => [inboxThreadResource(input.threadId)],
})
