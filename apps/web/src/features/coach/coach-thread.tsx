import { useState, type ReactNode } from "react"

import type { CoachUsageRating } from "@workspace/domain"

import { Chat, ChatThread } from "@/components/ai-elements/chat.tsx"
import type { HomeMessage } from "@/features/home/threads.ts"

import { CoachDock } from "./coach-dock.tsx"
import { CoachTurns } from "./coach-turns.tsx"

type Props = {
  messages: readonly HomeMessage[]
  empty?: ReactNode
  beforeComposer?: ReactNode
  waiting?: boolean
  turnActive?: boolean
  error?: string | null
  placeholder?: string
  send: (text: string) => boolean
  stop: () => void
  onRetry?: () => void
  onRate?: (messageId: string, rating: CoachUsageRating) => void
  onRegenerate?: () => void
  onUndo?: (messageId: string, toolCallId: string) => Promise<void>
  onAttachFromPaper?: () => void
  messageCite?: (message: HomeMessage) => ReactNode
}

export function CoachThread({
  messages,
  empty,
  beforeComposer,
  waiting = false,
  turnActive = false,
  error = null,
  placeholder = "Ask the Coach",
  send,
  stop,
  onAttachFromPaper,
  ...turns
}: Props) {
  const [draft, setDraft] = useState("")
  const isEmpty = messages.length === 0 && !turnActive && !error

  return (
    <Chat>
      {isEmpty ? (
        <div className="min-h-0 flex-1 overflow-auto">{empty}</div>
      ) : (
        <ChatThread>
          <CoachTurns
            messages={messages}
            waiting={waiting}
            error={error}
            {...turns}
          />
        </ChatThread>
      )}
      <div className="flex flex-col gap-2">
        {beforeComposer}
        <CoachDock
          draft={draft}
          setDraft={setDraft}
          onSend={() => {
            if (send(draft)) setDraft("")
          }}
          onStop={stop}
          turnActive={turnActive}
          placeholder={placeholder}
          menuPlacement="above"
          showModePicker={false}
          onAttachFromPaper={onAttachFromPaper}
        />
      </div>
    </Chat>
  )
}
