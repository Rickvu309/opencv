import { createContext } from "react"

import type { HomeMessage, HomeThread } from "@/features/home/threads.ts"

export type ThreadStoreValue = {
  threads: HomeThread[]
  activeThreadId: string | null
  messages: HomeMessage[]
  thinking: boolean
  send: (text: string) => boolean
  openThread: (id: string) => void
  newChat: () => void
}

export const ThreadStoreContext = createContext<ThreadStoreValue | null>(null)
