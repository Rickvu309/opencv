import { operation } from "@workspace/domain/operations/job/set-checklist-item"
import { z } from "zod"
import type { OperationBinding } from "../../../registry/bind.js"
import { setChecklistItem } from "../../checklist.js"
import { checklistItemUnchangedSince } from "../../undo-guards.js"

const privateResult = operation.publicResult
  .extend({ previousDone: z.boolean() })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) =>
    setChecklistItem(actor, input.jobId, input.itemId, input.done),
  reversal: (input, result) => ({
    command: operation.name,
    input: {
      jobId: input.jobId,
      itemId: input.itemId,
      done: result.previousDone,
    },
    expect: checklistItemUnchangedSince(
      input.jobId,
      result,
      "This checklist item changed again, so Undo was skipped"
    ),
  }),
  activity: (_input, result) => ({
    subjectKind: "job",
    subjectId: result.jobId,
    summary: result.done
      ? "You ticked a checklist item"
      : "You unticked a checklist item",
  }),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof setChecklistItem>>
>
