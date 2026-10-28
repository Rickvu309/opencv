import { createElement, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatStoreProvider } from "@/features/coach/chat-store.tsx"
import { toChatSummaries } from "@/features/coach/chat-list-port.ts"
import { useChatList } from "@/features/coach/use-chat-list.ts"
import { createQueryClient } from "@/lib/query-client.ts"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"
import { installChatApiMock } from "@/test/chat-api-mock.ts"

function wrapper({ children }: { children: ReactNode }) {
  installChatApiMock()
  const client = createQueryClient()
  return createElement(
    QueryClientProvider,
    { client },
    createElement(ChatStoreProvider, null, children)
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ChatListPort", () => {
  it("exposes only id/title Chats plus list actions", async () => {
    const { result } = renderHook(() => useChatList(), { wrapper })

    await waitFor(() => {
      expect(result.current.chats.length).toBe(FIXTURE_CHATS.length)
    })

    expect(Object.keys(result.current).sort()).toEqual([
      "activeChatId",
      "chats",
      "deleteChat",
      "newChat",
      "openChat",
    ])
    expect(result.current.activeChatId).toBeNull()
    expect(result.current.chats[0]).toEqual({
      id: FIXTURE_CHATS[0]!.id,
      title: FIXTURE_CHATS[0]!.title,
    })
    expect(Object.keys(result.current.chats[0]!).sort()).toEqual([
      "id",
      "title",
    ])
    expect(result.current.chats[0]).not.toHaveProperty("messages")
  })

  it("strips message internals when mapping to the port", () => {
    expect(toChatSummaries(FIXTURE_CHATS)).toEqual(
      FIXTURE_CHATS.map(({ id, title }) => ({ id, title }))
    )
  })
})
