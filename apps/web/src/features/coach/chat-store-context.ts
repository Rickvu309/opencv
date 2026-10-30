import { createContext } from "react"
import type { ChatSummary } from "@workspace/domain"

import type { CoachTurnProgress } from "./coach-progress.ts"
import type { CoachSendOptions } from "./use-coach-turn.ts"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

export type TurnPhase = "idle" | "waiting" | "streaming"

export type ChatStoreValue = {
  chats: ChatSummary[]
  activeChatId: string | null
  messages: ChatViewMessage[]
  phase: TurnPhase
  progress: CoachTurnProgress
  error: string | null
  send: (text: string, options?: CoachSendOptions) => boolean
  stop: () => void
  retry: () => boolean
  regenerate: () => boolean
  undo: (activityId: string) => Promise<void>
  openChat: (id: string) => void
  newChat: () => void
  deleteChat: (id: string) => Promise<void>
}

export const ChatStoreContext = createContext<ChatStoreValue | null>(null)
