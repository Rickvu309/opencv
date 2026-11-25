import { operation } from "@workspace/domain/operations/job/remove-checklist-item"
import type { OperationBinding } from "../../../registry/bind.js"
import { removeChecklistItem } from "../../checklist.js"

export const implementation = {
  operation,
  execute: (input, actor) =>
    removeChecklistItem(actor, input.jobId, input.itemId),
  reversal: { irreversible: "A removed checklist item is added back by hand." },
  activity: { silent: "Removing a checklist item leaves no receipt." },
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof removeChecklistItem>>
>
