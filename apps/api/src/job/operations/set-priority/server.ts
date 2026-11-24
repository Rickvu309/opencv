import { operation } from "@workspace/domain/operations/job/set-priority"
import { jobPrioritySchema } from "@workspace/domain"
import type { OperationBinding } from "../../../registry/bind.js"
import { takePriorityGrant } from "../../../registry/write-grant.js"
import { priorityRevision, writePriority } from "../../store.js"

const privateResult = operation.publicResult
  .extend({ previousPriority: jobPrioritySchema })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) =>
    writePriority(
      takePriorityGrant(input.jobId),
      input.jobId,
      input.priority,
      actor.userId
    ),
  basis: (input, actor) => priorityRevision(actor.userId, input.jobId),
  reversal: (input, result) => ({
    command: operation.name,
    input: { jobId: input.jobId, priority: result.previousPriority },
    expect: {
      query: "job.get",
      input: { jobId: input.jobId },
      matches: { priority: result.priority },
      skipped: "This priority changed again, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "job",
    subjectId: input.jobId,
    summary: `You set priority to ${input.priority}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  import("zod").output<typeof privateResult>
>
