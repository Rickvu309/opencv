import { useContext } from "react"

import { ChatStoreContext } from "@/features/coach/chat-store-context.ts"

export function useChatStore() {
  const value = useContext(ChatStoreContext)
  if (!value) {
    throw new Error("useChatStore must be used within ChatStoreProvider")
  }
  return value
}
