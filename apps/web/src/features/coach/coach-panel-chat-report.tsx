import { useEffect } from "react"

import { setCoachPanelChat } from "@/lib/coach-panel-presence.ts"

import { useChatStore } from "./use-chat-store.ts"

export function CoachPanelChatReport() {
  const { activeChatId } = useChatStore()
  useEffect(() => {
    setCoachPanelChat(activeChatId)
    return () => setCoachPanelChat(null)
  }, [activeChatId])
  return null
}
