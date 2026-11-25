import { z } from "zod"
import { accountRequestEmailChangeInputSchema } from "../../../account/account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "account.requestEmailChange",
  version: 1,
  kind: "command",
  description: "Ask for a code to change the sign-in email.",
  input: accountRequestEmailChangeInputSchema,
  publicResult: z
    .object({
      email: z.string(),
      sent: z.boolean(),
      message: z.string().optional(),
    })
    .strict(),
  coach: "never",
  destructive: false,
  idempotency: "none",
  writes: () => [],
})
