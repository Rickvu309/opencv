import { useMemo } from "react"

import {
  toChatSummaries,
  type ChatListPort,
} from "@/features/coach/chat-list-port.ts"
import { useChatStore } from "@/features/coach/use-chat-store.ts"

export function useChatList(): ChatListPort {
  const { chats, activeChatId, openChat, newChat, deleteChat } = useChatStore()

  return useMemo(
    () => ({
      chats: toChatSummaries(chats),
      activeChatId,
      openChat,
      newChat,
      deleteChat: (id: string) => {
        void deleteChat(id)
      },
    }),
    [chats, activeChatId, openChat, newChat, deleteChat]
  )
}
