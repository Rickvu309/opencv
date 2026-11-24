import { z } from "zod"
import { accountDeleteInputSchema } from "../../../account.js"
import { defineOperation } from "../../../operation.js"

export const operation = defineOperation({
  owner: "account",
  name: "account.delete",
  version: 1,
  kind: "command",
  description: "Delete the account and every row it owns.",
  input: accountDeleteInputSchema,
  publicResult: z.object({ deleted: z.literal(true) }).strict(),
  coach: "never",
  destructive: true,
  idempotency: "none",
  writes: () => [],
})
