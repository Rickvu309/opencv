import { useQueryClient } from "@tanstack/react-query"
import type { JobId, JobPriority, JobStage } from "@workspace/domain"

import { toastWithUndo } from "@workspace/ui/components/sonner"

import { reportRejected } from "@/lib/command-failure.ts"
import {
  catalogClient,
  undoActivity,
  useRunCommand,
} from "@/lib/contract-client.ts"

export function useJobActions(id: JobId) {
  const queryClient = useQueryClient()
  const run = useRunCommand()

  async function changeStage(stage: JobStage) {
    const result = await run("job.move", { jobId: id, stage })
    if (stage === "closed" && result.activityId) {
      const activityId = result.activityId
      toastWithUndo("Moved to Closed", () => {
        void undoActivity(queryClient, activityId).catch(
          reportRejected("undo the move")
        )
      })
    }
  }

  async function changePriority(priority: JobPriority) {
    const result = await catalogClient.run(queryClient, "job.setPriority", {
      jobId: id,
      priority,
    })
    if ("activityId" in result && result.activityId) {
      const activityId = result.activityId
      toastWithUndo(`Priority set to ${priority}`, () => {
        void undoActivity(queryClient, activityId).catch(
          reportRejected("undo the priority change")
        )
      })
    }
  }

  return {
    onStage: (stage: JobStage) =>
      void changeStage(stage).catch(reportRejected("move this job")),
    onPriority: (priority: JobPriority) =>
      void changePriority(priority).catch(reportRejected("set priority")),
  }
}
