import type { NotifyTopic } from "@workspace/domain"
import type { QueryClient } from "@tanstack/react-query"

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
