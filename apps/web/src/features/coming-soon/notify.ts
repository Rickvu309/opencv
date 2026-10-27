import { runCommand } from "@/lib/api-envelope.ts"

export type NotifyTopic = "jobs" | "proof" | "pitch"

type NotifyRow = {
  id: string
  topic: string
  createdAt: string
}

function storageKey(topic: NotifyTopic) {
  return `opencv.notify.${topic}`
}

export async function requestNotify(topic: NotifyTopic) {
  const row = await runCommand<NotifyRow>("notify.request", { topic })
  const key = storageKey(topic)
  const already = sessionStorage.getItem(key) === row.id
  sessionStorage.setItem(key, row.id)
  return { row, already }
}
