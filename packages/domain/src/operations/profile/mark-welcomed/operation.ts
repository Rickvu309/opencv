import {
  profileMarkWelcomedInputSchema,
  profileResource,
  profileSchema,
} from "../../../account/account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "profile.markWelcomed",
  version: 1,
  kind: "command",
  description: "Record that the welcome screen finished.",
  label: "Finish your welcome",
  input: profileMarkWelcomedInputSchema,
  publicResult: profileSchema,
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: () => [profileResource],
})
