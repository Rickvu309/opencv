import { z } from "zod"
import { integrationsSchema, profileResource } from "../../../account.js"
import { inboxThreadResource } from "../../../inbox.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "integrations.list",
  version: 1,
  kind: "read",
  description: "Read the integrations catalog.",
  input: z.object({}).strict(),
  publicResult: integrationsSchema,
  coach: "never",
  dependsOn: () => [profileResource, inboxThreadResource()],
})
