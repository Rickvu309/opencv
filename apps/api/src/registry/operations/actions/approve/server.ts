import { operation } from "@workspace/domain/operations/actions/approve"
import type { OperationBinding } from "../../../bind.js"
import { toActivityRow } from "../../rows.js"

export const implementation = {
  operation,
  execute: async (input, actor, registry) => {
    const row = await registry.approve(actor.userId, input.pendingActionId)
    return row ? toActivityRow(row) : null
  },
  reversal: {
    irreversible: "Approving runs another command, which carries its own Undo.",
  },
  activity: { silent: "The approved command writes the receipt." },
} satisfies OperationBinding<
  typeof operation,
  ReturnType<typeof toActivityRow> | null
>
