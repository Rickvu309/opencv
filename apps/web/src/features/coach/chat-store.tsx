import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import type { ChatSummary } from "@workspace/domain"

import { useCoachTurn } from "@/features/coach/use-coach-turn.ts"
import {
  deleteChat as deleteChatRequest,
  listChats,
  chatDetailKey,
  chatListKey,
} from "@/features/coach/chat-api.ts"
import { ChatStoreContext } from "@/features/coach/chat-store-context.ts"
import { titleFrom } from "@/features/coach/chat-messages.ts"
import { refreshReads } from "@/lib/contract-client.ts"

const EMPTY_CHATS: ChatSummary[] = []

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: chatListKey(),
    queryFn: listChats,
  })
  const chats = listQuery.data ?? EMPTY_CHATS

  const {
    messages,
    phase,
    step,
    error,
    send,
    stop,
    retry,
    regenerate,
    undo,
    cancelInFlight,
  } = useCoachTurn({
    chatId: activeChatId,
    setChatId: setActiveChatId,
    titleForCreate: titleFrom,
    onAfterUndo: () => {
      void refreshReads(queryClient, [{ query: "profile.get" }])
    },
  })

  const newChat = useCallback(() => {
    cancelInFlight()
    setActiveChatId(null)
  }, [cancelInFlight])

  const deleteChat = useCallback(
    async (id: string) => {
      await deleteChatRequest(queryClient, id)
      queryClient.removeQueries({ queryKey: chatDetailKey(id) })
      if (activeChatId === id) {
        cancelInFlight()
        setActiveChatId(null)
      }
    },
    [activeChatId, cancelInFlight, queryClient]
  )

  const openChat = useCallback(
    (id: string) => {
      if (id === activeChatId) return
      cancelInFlight()
      setActiveChatId(id)
    },
    [activeChatId, cancelInFlight]
  )

  const value = useMemo(
    () => ({
      chats,
      activeChatId,
      messages,
      phase,
      step,
      error,
      send,
      stop,
      retry,
      regenerate,
      undo,
      openChat,
      newChat,
      deleteChat,
    }),
    [
      chats,
      activeChatId,
      messages,
      phase,
      step,
      error,
      send,
      stop,
      retry,
      regenerate,
      undo,
      openChat,
      newChat,
      deleteChat,
    ]
  )

  return (
    <ChatStoreContext.Provider value={value}>
      {children}
    </ChatStoreContext.Provider>
  )
}
