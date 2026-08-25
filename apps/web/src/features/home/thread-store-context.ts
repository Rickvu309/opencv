import { createContext } from "react"
import type { CoachUsageRating, ThreadListItem } from "@workspace/domain"

import type { HomeMessage } from "@/features/home/threads.ts"

export type TurnPhase = "idle" | "waiting" | "streaming"

export type ThreadStoreValue = {
  threads: ThreadListItem[]
  activeThreadId: string | null
  messages: HomeMessage[]
  phase: TurnPhase
  send: (text: string) => boolean
  stop: () => void
  retry: () => boolean
  rate: (messageId: string, rating: CoachUsageRating) => void
  openThread: (id: string) => void
  newThread: () => void
}

export const ThreadStoreContext = createContext<ThreadStoreValue | null>(null)
