import { jobViewSchema } from "@workspace/domain/apply"
import { operation } from "@workspace/domain/operations/job/star"
import { z } from "zod"
import type { OperationBinding } from "../../../registry/bind.js"
import { starJob } from "../../board.js"

const privateResult = jobViewSchema
  .extend({ previousStarred: z.boolean() })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) => starJob(actor, input.jobId, input.starred),
  reversal: (input, result) => ({
    command: operation.name,
    input: { jobId: input.jobId, starred: result.previousStarred },
    expect: {
      query: "job.get",
      input: { jobId: input.jobId },
      matches: { starred: input.starred },
      skipped: "This star changed again, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "job",
    subjectId: input.jobId,
    summary: input.starred ? "You starred it" : "You unstarred it",
  }),
} satisfies OperationBinding<typeof operation, z.output<typeof privateResult>>
