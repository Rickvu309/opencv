import { catalog } from "@workspace/domain"
import { operation } from "@workspace/domain/operations/job/move"
import { z } from "zod"
import type { OperationBinding } from "../../../registry/bind.js"
import { moveJob } from "../../board.js"

const privateResult = operation.publicResult
  .extend({ fromPosition: z.string() })
  .strict()

export const implementation = {
  operation,
  privateResult,
  execute: (input, actor) =>
    moveJob(actor, input.jobId, input.stage, input.position),
  reversal: (input, result) => ({
    command: operation.name,
    input: {
      jobId: input.jobId,
      stage: result.fromStage,
      position: result.fromPosition,
    },
    expect: {
      query: catalog["job.get"].name,
      input: { jobId: input.jobId },
      matches: { stage: result.stage, position: result.position },
      skipped: "This card moved again, so Undo was skipped",
    },
  }),
  activity: (input) => ({
    subjectKind: "job",
    subjectId: input.jobId,
    summary: `You moved it to ${input.stage}`,
  }),
} satisfies OperationBinding<
  typeof operation,
  Awaited<ReturnType<typeof moveJob>>
>
