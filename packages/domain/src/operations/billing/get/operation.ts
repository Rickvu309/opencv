import { z } from "zod"
import { billingSchema, profileResource } from "../../../account/account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "billing.get",
  version: 1,
  kind: "read",
  description: "Read the plan and billing placeholder.",
  label: "Look at your plan",
  readLabel: "Looked at your plan",
  input: z.object({}).strict(),
  publicResult: billingSchema,
  coach: "never",
  dependsOn: () => [profileResource],
})
