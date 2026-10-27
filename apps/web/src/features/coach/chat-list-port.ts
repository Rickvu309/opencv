export type ChatSummary = {
  id: string
  title: string
}

export type ChatListPort = {
  chats: ChatSummary[]
  activeChatId: string | null
  openChat: (id: string) => void
  newChat: () => void
  deleteChat: (id: string) => void
}

export function toChatSummaries(
  chats: ReadonlyArray<{ id: string; title: string }>
): ChatSummary[] {
  return chats.map(({ id, title }) => ({ id, title }))
}
