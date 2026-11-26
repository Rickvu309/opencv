import { catalog } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/job/add-checklist-item"
import type { OperationBinding } from "../../../registry/bind.js"
import { addChecklistItem } from "../../checklist.js"
import { checklistItemUnchangedSince } from "../../undo-guards.js"

export const implementation = {
  operation,
  execute: (input, actor) => addChecklistItem(actor, input.jobId, input.label),
  reversal: (_input, result) => ({
    command: catalog["job.removeChecklistItem"].name,
    input: { jobId: result.jobId, itemId: result.id },
    expect: checklistItemUnchangedSince(
      result.jobId,
      result,
      "This checklist item changed again, so Undo was skipped"
    ),
  }),
  activity: (_input, result) => ({
    subjectKind: "job",
    subjectId: result.jobId,
    summary: `You added "${result.label}" to the checklist`,
  }),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof addChecklistItem>>
>
