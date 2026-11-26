import { catalog } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/job/create"
import type { OperationBinding } from "../../../registry/bind.js"
import { createJob } from "../../board.js"
import { jobUnchangedSince } from "../../undo-guards.js"

export const implementation = {
  operation,
  execute: (input, actor) => createJob(actor, input),
  reversal: (_input, result) => ({
    command: catalog["job.delete"].name,
    input: { jobId: result.id },
    expect: jobUnchangedSince(
      result.id,
      result,
      "This job changed after it was saved, so Undo was skipped"
    ),
  }),
  activity: (_input, result) => ({
    subjectKind: "job",
    subjectId: result.id,
    summary: `You added this job from ${result.sourceLabel}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof createJob>>
>
