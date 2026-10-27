import type { ChatSummary } from "@/features/coach/chat-list-port.ts"

export type SearchChat = {
  id: string
  title: string
  when: string
  preview?: string
}

export function searchChatsFromList(chats: ChatSummary[]): SearchChat[] {
  return chats.map((chat, index) => ({
    id: chat.id,
    title: chat.title,
    when: index === 0 ? "Today" : index === 1 ? "Yesterday" : "Earlier",
  }))
}
