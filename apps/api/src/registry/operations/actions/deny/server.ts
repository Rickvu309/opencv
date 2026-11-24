import { operation } from "@workspace/domain/operations/actions/deny"
import type { OperationBinding } from "../../../bind.js"
import { toPendingActionRow } from "../../rows.js"

export const implementation = {
  operation,
  execute: async (input, actor, registry) =>
    toPendingActionRow(
      await registry.deny(actor.userId, input.pendingActionId)
    ),
  reversal: { irreversible: "A declined action stays declined." },
  activity: { silent: "Declining changes nothing a receipt could describe." },
} satisfies OperationBinding<
  typeof operation,
  ReturnType<typeof toPendingActionRow>
>
