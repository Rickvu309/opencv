import { operation } from "@workspace/domain/operations/notify/request"
import type { OperationBinding } from "../../../../registry/bind.js"
import { requestNotify } from "../../../own-account.js"

export const implementation = {
  operation,
  execute: (input, actor) => requestNotify(actor, input.topic),
  reversal: { irreversible: "A notify request stays on the list." },
  activity: { silent: "Asking to be notified leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof requestNotify>>
>
