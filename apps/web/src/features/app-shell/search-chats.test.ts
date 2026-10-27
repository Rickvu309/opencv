import { describe, expect, it } from "vitest"

import { searchChatsFromList } from "@/features/app-shell/search-chats.ts"
import { toChatSummaries } from "@/features/coach/chat-list-port.ts"
import { FIXTURE_CHATS } from "@/test/chat-fixtures.ts"

describe("searchChatsFromList", () => {
  it("maps port Chats to chrome DTOs without message internals", () => {
    const mapped = searchChatsFromList(toChatSummaries(FIXTURE_CHATS))

    expect(mapped[0]).toEqual({
      id: FIXTURE_CHATS[0]!.id,
      title: FIXTURE_CHATS[0]!.title,
      when: "Today",
    })
    expect(mapped[1]?.when).toBe("Yesterday")
    expect(mapped[2]?.when).toBe("Earlier")
    expect(mapped[0]).not.toHaveProperty("messages")
    expect(mapped[0]?.preview).toBeUndefined()
  })
})
