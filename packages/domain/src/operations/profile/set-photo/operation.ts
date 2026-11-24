import {
  profileSetPhotoInputSchema,
  profileResource,
  profileSchema,
} from "../../../account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "profile.setPhoto",
  version: 1,
  kind: "command",
  description: "Set the profile photo from an uploaded file.",
  input: profileSetPhotoInputSchema,
  publicResult: profileSchema,
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: () => [profileResource],
})
