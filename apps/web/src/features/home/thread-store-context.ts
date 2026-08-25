import { createContext } from "react"
import type { ThreadListItem } from "@workspace/domain"

import type { HomeMessage } from "@/features/home/threads.ts"

export type ThreadStoreValue = {
  threads: ThreadListItem[]
  activeThreadId: string | null
  messages: HomeMessage[]
  thinking: boolean
  send: (text: string) => boolean
  openThread: (id: string) => void
  newThread: () => void
}

export const ThreadStoreContext = createContext<ThreadStoreValue | null>(null)
