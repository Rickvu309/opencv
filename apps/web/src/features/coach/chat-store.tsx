import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useReducer, type ReactNode } from "react"
import type { ChatSummary } from "@workspace/domain"

import {
  useCoachTurn,
  type CoachSendOptions,
} from "@/features/coach/use-coach-turn.ts"
import {
  deleteChat as deleteChatRequest,
  listChats,
  chatDetailKey,
  chatListKey,
} from "@/features/coach/chat-api.ts"
import { ChatStoreContext } from "@/features/coach/chat-store-context.ts"
import { titleFrom } from "@/features/coach/chat-messages.ts"
import { refreshReads } from "@/lib/contract-client.ts"

type ActiveChatState = {
  activeChatId: string | null
  navigationRevision: number
  creationOwner: string | null
}

type ActiveChatAction =
  | { type: "active_chat_opened"; id: string }
  | { type: "active_chat_cleared" }
  | { type: "chat_created"; id: string }
  | { type: "creation_started"; owner: string | null }

function activeChatReducer(
  state: ActiveChatState,
  action: ActiveChatAction
): ActiveChatState {
  if (action.type === "creation_started") {
    return { ...state, creationOwner: action.owner }
  }
  return {
    creationOwner: action.type === "chat_created" ? state.creationOwner : null,
    activeChatId: action.type === "active_chat_cleared" ? null : action.id,
    navigationRevision:
      state.navigationRevision + (action.type === "chat_created" ? 0 : 1),
  }
}

const EMPTY_CHATS: ChatSummary[] = []

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [{ activeChatId, navigationRevision, creationOwner }, dispatch] =
    useReducer(activeChatReducer, {
      activeChatId: null,
      navigationRevision: 0,
      creationOwner: null,
    })

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
    send: sendTurn,
    stop,
    retry,
    regenerate,
    undo,
    cancelInFlight,
  } = useCoachTurn({
    chatId: activeChatId,
    setChatId: (id) => dispatch({ type: "chat_created", id }),
    titleForCreate: titleFrom,
    onAfterUndo: () => {
      void refreshReads(queryClient, [{ query: "profile.get" }])
    },
  })

  const send = useCallback(
    (text: string, options?: CoachSendOptions, owner?: string) => {
      const accepted = sendTurn(text, options)
      if (accepted && activeChatId === null) {
        dispatch({ type: "creation_started", owner: owner ?? null })
      }
      return accepted
    },
    [activeChatId, sendTurn]
  )

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
      navigationRevision,
      creationOwner,
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
      navigationRevision,
      creationOwner,
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
