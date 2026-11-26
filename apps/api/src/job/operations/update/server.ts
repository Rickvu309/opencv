import { jobPatchSchema, jobViewSchema } from "@workspace/domain/apply"
import { operation } from "@workspace/domain/operations/job/update"
import { z } from "zod"
import type { OperationBinding } from "../../../registry/bind.js"
import { takePriorityGrant } from "../../../registry/write-grant.js"
import { updateJob } from "../../board.js"
import { priorityRevision, writePriority } from "../../store.js"
import { jobUnchangedSince } from "../../undo-guards.js"

const privateResult = jobViewSchema
  .extend({ previousPatch: jobPatchSchema, watched: z.boolean() })
  .strict()

export const implementation = {
  operation,
  privateResult,
  basis: async (input, actor) =>
    input.patch.priority === undefined
      ? null
      : priorityRevision(actor.userId, input.jobId),
  execute: async (input, actor) => {
    const saved = await updateJob(actor, input.jobId, input.patch)
    if (input.patch.priority === undefined) return saved
    const written = await writePriority(
      takePriorityGrant(input.jobId),
      input.jobId,
      input.patch.priority
    )
    const { previousPriority, ...job } = written
    void previousPriority
    return {
      ...job,
      previousPatch: saved.previousPatch,
      watched: saved.watched,
    }
  },
  reversal: (input, result) => ({
    command: operation.name,
    input: { jobId: input.jobId, patch: result.previousPatch },
    expect: jobUnchangedSince(
      input.jobId,
      result,
      "This job changed again, so Undo was skipped"
    ),
  }),
  activity: (input, result, actor) =>
    result.watched || actor.type === "delegate"
      ? {
          subjectKind: "job",
          subjectId: input.jobId,
          summary: "Updated the job",
        }
      : null,
} satisfies OperationBinding<typeof operation, z.output<typeof privateResult>>
