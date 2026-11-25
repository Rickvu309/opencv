import { operation } from "@workspace/domain/operations/billing/get"
import type { OperationBinding } from "../../../../registry/bind.js"
import { readBilling } from "../../../queries.js"

export const implementation = {
  operation,
  execute: (_input, actor) => readBilling(actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readBilling>>
>
