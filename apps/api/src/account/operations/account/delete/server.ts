import { operation } from "@workspace/domain/operations/account/delete"
import type { OperationBinding } from "../../../../registry/bind.js"
import { deleteOwnedAccount } from "../../../own-account.js"

export const implementation = {
  operation,
  execute: (input, actor) => deleteOwnedAccount(actor, input.confirm),
  reversal: { irreversible: "A deleted account is gone for good." },
  activity: { silent: "The receipts go with the account." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof deleteOwnedAccount>>
>
