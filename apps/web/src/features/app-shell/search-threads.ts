import type { HomeThread } from "@/features/home/threads.ts"

export type SearchThread = {
  id: string
  title: string
  when: string
  preview?: string
}

export function searchThreadsFromHome(threads: HomeThread[]): SearchThread[] {
  return threads.map((thread, index) => {
    const preview = [...thread.messages]
      .reverse()
      .find((message) => message.role === "coach")?.text

    return {
      id: thread.id,
      title: thread.title,
      when: index === 0 ? "Today" : index === 1 ? "Yesterday" : "Earlier",
      preview,
    }
  })
}
