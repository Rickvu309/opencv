import type { ThreadListItem } from "@/features/home/thread-list-port.ts"

export type SearchThread = {
  id: string
  title: string
  when: string
  preview?: string
}

export function searchThreadsFromList(
  threads: ThreadListItem[]
): SearchThread[] {
  return threads.map((thread, index) => ({
    id: thread.id,
    title: thread.title,
    when: index === 0 ? "Today" : index === 1 ? "Yesterday" : "Earlier",
  }))
}
