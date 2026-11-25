import type { JobId } from "@workspace/domain"
import { operation } from "@workspace/domain/operations/job/add-note"
import type { OperationBinding } from "../../../registry/bind.js"
import { ownedJob } from "../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor) => {
    await ownedJob(actor.userId, input.jobId)
    return { jobId: input.jobId, body: input.body }
  },
  reversal: { irreversible: "A note stays in the job's history." },
  activity: (input) => ({
    subjectKind: "job",
    subjectId: input.jobId,
    summary: input.body,
  }),
} satisfies OperationBinding<typeof operation, { jobId: JobId; body: string }>
