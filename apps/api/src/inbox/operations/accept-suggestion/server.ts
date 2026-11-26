import { catalog, ERROR_CODES } from "@workspace/domain/kernel"
import { operation } from "@workspace/domain/operations/inbox/accept-suggestion"
import { CommandError } from "../../../platform/errors.js"
import type { OperationBinding } from "../../../registry/bind.js"
import { clearSuggestion, readInboxThread } from "../../store.js"

export const implementation = {
  operation,
  execute: async (input, actor, registry) => {
    const detail = await readInboxThread(actor.userId, input.threadId)
    if (!detail.jobId) {
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "This email is not linked to a job yet."
      )
    }
    if (detail.suggestedStage !== "interview") {
      throw new CommandError(
        ERROR_CODES.VALIDATION_ERROR,
        "There is no stage to move this job to."
      )
    }
    const moved = await registry.execute({
      name: catalog["job.move"].name,
      input: { jobId: detail.jobId, stage: detail.suggestedStage },
      actor,
    })
    await clearSuggestion(actor, input.threadId)
    if (!moved.activityId) {
      throw new CommandError(
        ERROR_CODES.INTERNAL_ERROR,
        "Could not move the job. Try it again."
      )
    }
    return {
      id: input.threadId,
      jobId: detail.jobId,
      stage: detail.suggestedStage,
      activityId: moved.activityId,
    }
  },
  reversal: { irreversible: "The job move has its own Undo." },
  activity: { silent: "The job move writes the receipt." },
} satisfies OperationBinding<
  typeof operation,
  { id: string; jobId: string; stage: "interview"; activityId: string }
>
