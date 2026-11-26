import {
  inboxDetailSchema,
  inboxThreadResource,
  threadInput,
} from "../../../inbox/index.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "inbox",
  name: "inbox.get",
  version: 1,
  kind: "read",
  description: "Read one email thread.",
  label: "Read this message",
  readLabel: "Read this message",
  input: threadInput,
  publicResult: inboxDetailSchema,
  coach: "never",
  coachPermission: "agentEmail",
  dependsOn: (input) => [inboxThreadResource(input.threadId)],
})
