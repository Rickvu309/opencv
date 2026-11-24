import { operation } from "@workspace/domain/operations/activity/undo"
import type { OperationBinding } from "../../../bind.js"
import { toActivityRow } from "../../rows.js"

export const implementation = {
  operation,
  execute: async (input, actor, registry) =>
    toActivityRow(await registry.undo(actor.userId, input.activityId)),
  reversal: { irreversible: "An Undo is not undone." },
  activity: { silent: "Undo marks the original receipt as undone." },
} satisfies OperationBinding<typeof operation, ReturnType<typeof toActivityRow>>
