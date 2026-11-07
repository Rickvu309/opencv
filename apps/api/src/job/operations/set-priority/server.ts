import { operation } from "@workspace/domain/operations/job/set-priority"
import { jobPrioritySchema } from "@workspace/domain"
import type { OperationBinding } from "../../../registry/bind.js"
import { setPriority } from "../../store.js"

const privateResult = operation.publicResult
  .extend({ previousPriority: jobPrioritySchema })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) => setPriority(actor, input.jobId, input.priority),
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
