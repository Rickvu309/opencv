import type { QueryClient } from "@tanstack/react-query"
import { parseChatId } from "@workspace/domain"
import { startCoachTask } from "@/lib/coach-task-client.ts"
import { runContractCommand } from "@/lib/contract-client.ts"
import {
  fulfillCoachStop,
  type CoachStopTarget,
} from "@/lib/coach-stop-registry.ts"

export {
  fulfillCoachStop,
  type CoachStopTarget,
} from "@/lib/coach-stop-registry.ts"

export function requestCoachStop(
  queryClient: QueryClient,
  target: CoachStopTarget,
  onFailure: (taskId: string | null, error: unknown) => void
) {
  return fulfillCoachStop(
    target,
    {
      start: (input, startKey, signal) =>
        startCoachTask(queryClient, input, startKey, signal),
      stop: (chatId, taskId, signal) =>
        runContractCommand(
          queryClient,
          "coach.stop",
          {
            chatId: parseChatId(chatId),
            taskId,
          },
          { signal }
        ),
      retryDelay: (attempt, signal) =>
        new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer)
            signal.removeEventListener("abort", done)
            resolve()
          }
          const timer = setTimeout(done, 300 * 2 ** attempt)
          signal.addEventListener("abort", done, { once: true })
          if (signal.aborted) done()
        }),
    },
    onFailure
  )
}
