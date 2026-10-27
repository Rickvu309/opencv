import { useEffect, useRef, useState } from "react"

import { CoachDock } from "@/features/coach/coach-dock.tsx"
import { ChatView } from "@/features/coach/chat-view.tsx"
import { useChatStore } from "@/features/coach/use-chat-store.ts"

export function ShellChatBody({ chatId = null }: { chatId?: string | null }) {
  const {
    messages,
    phase,
    error,
    send,
    stop,
    retry,
    regenerate,
    undo,
    openChat,
  } = useChatStore()
  const [draft, setDraft] = useState("")
  const turnActive = phase !== "idle"
  const seenChat = useRef(chatId)

  useEffect(() => {
    if (seenChat.current !== chatId) {
      seenChat.current = chatId
      setDraft("")
    }
    if (chatId) openChat(chatId)
  }, [chatId, openChat])

  function handleSend() {
    const text = draft.trim()
    if (!text) return
    if (send(text)) setDraft("")
  }

  return (
    <div data-slot="coach-panel-body" className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <ChatView
          messages={messages}
          waiting={phase === "waiting"}
          error={error}
          onRetry={retry}
          onRegenerate={phase === "idle" ? regenerate : undefined}
          onUndo={phase === "idle" ? undo : undefined}
        />
      </div>
      <div className="shrink-0 px-3 pt-2 pb-3">
        <CoachDock
          draft={draft}
          setDraft={setDraft}
          onSend={handleSend}
          onStop={stop}
          turnActive={turnActive}
          menuPlacement="above"
        />
      </div>
    </div>
  )
}
