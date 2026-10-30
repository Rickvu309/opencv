import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useReducer, type ReactNode } from "react"
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

type ActiveChatAction =
  { type: "active_chat_opened"; id: string } | { type: "active_chat_cleared" }

function activeChatReducer(
  _id: string | null,
  action: ActiveChatAction
): string | null {
  return action.type === "active_chat_opened" ? action.id : null
}

const EMPTY_CHATS: ChatSummary[] = []

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [activeChatId, dispatch] = useReducer(activeChatReducer, null)

  const listQuery = useQuery({
    queryKey: chatListKey(),
    queryFn: listChats,
  })
  const chats = listQuery.data ?? EMPTY_CHATS

  const {
    messages,
    phase,
    progress,
    error,
    send,
    stop,
    retry,
    regenerate,
    undo,
    cancelInFlight,
  } = useCoachTurn({
    chatId: activeChatId,
    setChatId: (id) => dispatch({ type: "active_chat_opened", id }),
    titleForCreate: titleFrom,
    onAfterUndo: () => {
      void refreshReads(queryClient, [{ query: "profile.get" }])
    },
  })

  const newChat = useCallback(() => {
    cancelInFlight()
    dispatch({ type: "active_chat_cleared" })
  }, [cancelInFlight])

  const deleteChat = useCallback(
    async (id: string) => {
      await deleteChatRequest(queryClient, id)
      queryClient.removeQueries({ queryKey: chatDetailKey(id) })
      if (activeChatId === id) {
        cancelInFlight()
        dispatch({ type: "active_chat_cleared" })
      }
    },
    [activeChatId, cancelInFlight, queryClient]
  )

  const openChat = useCallback(
    (id: string) => {
      if (id === activeChatId) return
      cancelInFlight()
      dispatch({ type: "active_chat_opened", id })
    },
    [activeChatId, cancelInFlight]
  )

  const value = useMemo(
    () => ({
      chats,
      activeChatId,
      messages,
      phase,
      progress,
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
      progress,
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
