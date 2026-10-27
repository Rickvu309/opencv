export type ChatListPortItem = {
  id: string
  title: string
}

export type ChatListPort = {
  chats: ChatListPortItem[]
  activeChatId: string | null
  openChat: (id: string) => void
  newChat: () => void
  deleteChat: (id: string) => void
}

export function toChatSummaries(
  chats: ReadonlyArray<{ id: string; title: string }>
): ChatListPortItem[] {
  return chats.map(({ id, title }) => ({ id, title }))
}
