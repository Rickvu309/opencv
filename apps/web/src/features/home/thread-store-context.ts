import { createContext } from "react"
import type { ThreadListItem } from "@workspace/domain"

import type { HomeMessage } from "@/features/home/threads.ts"

export type TurnPhase = "idle" | "waiting" | "streaming"

export type ThreadStoreValue = {
  threads: ThreadListItem[]
  activeThreadId: string | null
  messages: HomeMessage[]
  phase: TurnPhase
  error: string | null
  send: (text: string) => boolean
  stop: () => void
  retry: () => boolean
  regenerate: () => boolean
  undo: (activityId: string) => Promise<void>
  openThread: (id: string) => void
  newThread: () => void
  deleteThread: (id: string) => Promise<void>
}

export const ThreadStoreContext = createContext<ThreadStoreValue | null>(null)
