import { operation } from "@workspace/domain/operations/account/request-email-change"
import type { OperationBinding } from "../../../../registry/bind.js"
import { requestEmailChange } from "../../../own-account.js"

export const implementation = {
  operation,
  execute: (input) => requestEmailChange(input.email),
  transaction: "none",
  reversal: { irreversible: "A sent code is left to expire." },
  activity: { silent: "Asking for a code changes nothing yet." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof requestEmailChange>>
>
