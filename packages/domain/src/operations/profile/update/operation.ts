import {
  profileUpdateInputSchema,
  profileResource,
  profileSchema,
} from "../../../account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "profile.update",
  version: 1,
  kind: "command",
  description: "Update profile, plan mode, and agent settings.",
  input: profileUpdateInputSchema,
  publicResult: profileSchema,
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: () => [profileResource],
})
