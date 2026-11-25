import { z } from "zod"
import { profileResource, profileSchema } from "../../../account/account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "profile.get",
  version: 1,
  kind: "read",
  description: "Read the signed-in profile.",
  input: z.object({}).strict(),
  publicResult: profileSchema,
  coach: "auto",
  dependsOn: () => [profileResource],
})
