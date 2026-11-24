import {
  profileMarkWelcomedInputSchema,
  profileResource,
  profileSchema,
} from "../../../account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "profile.markWelcomed",
  version: 1,
  kind: "command",
  description: "Record that the welcome screen finished.",
  input: profileMarkWelcomedInputSchema,
  publicResult: profileSchema,
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: () => [profileResource],
})
