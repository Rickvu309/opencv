import { useReducer } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { NotifyTopic } from "@workspace/domain"
import { toast } from "sonner"

import { soonCopy } from "@/features/coming-soon/copy.ts"
import {
  initialNotifyState,
  notifyReducer,
} from "@/features/coming-soon/notify.reducer.ts"
import { runContractCommand } from "@/lib/contract-client.ts"

function storageKey(topic: NotifyTopic) {
  return `opencv.notify.${topic}`
}

export async function requestNotify(
  queryClient: QueryClient,
  topic: NotifyTopic
) {
  const row = await runContractCommand(queryClient, "notify.request", {
    topic,
  })
  const key = storageKey(topic)
  const already = sessionStorage.getItem(key) === row.id
  sessionStorage.setItem(key, row.id)
  return { row, already }
}

export function useNotify(topic: NotifyTopic) {
  const queryClient = useQueryClient()
  const [{ pending, error }, dispatch] = useReducer(
    notifyReducer,
    initialNotifyState
  )

  async function notify() {
    dispatch({ type: "requested" })
    try {
      const result = await requestNotify(queryClient, topic)
      toast(result.already ? soonCopy.already : soonCopy.onList)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.trim() : ""
      dispatch({
        type: "failed",
        message: message || "Could not save that. Try again.",
      })
    } finally {
      dispatch({ type: "settled" })
    }
  }

  return { pending, error, notify }
}
