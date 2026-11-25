import { operation } from "@workspace/domain/operations/coach/usage"
import type { OperationBinding } from "../../../../registry/bind.js"
import { readUsage } from "../../../usage.js"

export const implementation = {
  operation,
  execute: (_input, actor) => readUsage(actor.userId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof readUsage>>
>
