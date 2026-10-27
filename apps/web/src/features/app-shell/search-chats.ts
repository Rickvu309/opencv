import { chatDisplayTitle } from "@workspace/domain"

import type { ChatListPortItem } from "@/features/coach/chat-list-port.ts"

export type SearchChat = {
  id: string
  title: string
  when: string
  preview?: string
}

export function searchChatsFromList(chats: ChatListPortItem[]): SearchChat[] {
  return chats.map((chat, index) => ({
    id: chat.id,
    title: chatDisplayTitle(chat.title),
    when: index === 0 ? "Today" : index === 1 ? "Yesterday" : "Earlier",
  }))
}
