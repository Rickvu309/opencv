import { useState } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { NotifyTopic } from "@workspace/domain"
import { toast } from "sonner"

import { soonCopy } from "@/features/coming-soon/copy.ts"
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
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function notify() {
    setPending(true)
    setError(null)
    try {
      const result = await requestNotify(queryClient, topic)
      toast(result.already ? soonCopy.already : soonCopy.onList)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.trim() : ""
      setError(message || "Could not save that. Try again.")
    } finally {
      setPending(false)
    }
  }

  return { pending, error, notify }
}
