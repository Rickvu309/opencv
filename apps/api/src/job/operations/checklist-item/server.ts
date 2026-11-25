import { operation } from "@workspace/domain/operations/job/checklist-item"
import type { OperationBinding } from "../../../registry/bind.js"
import { checklistItemOf } from "../../checklist.js"

export const implementation = {
  operation,
  execute: (input, actor) => checklistItemOf(actor, input.jobId, input.itemId),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof checklistItemOf>>
>
