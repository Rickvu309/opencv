import { describe, expect, it } from "vitest"

import { searchThreadsFromList } from "@/features/app-shell/search-threads.ts"
import { toThreadListItems } from "@/features/home/thread-list-port.ts"
import { FIXTURE_THREADS } from "@/test/thread-fixtures.ts"

describe("searchThreadsFromList", () => {
  it("maps port Threads to chrome DTOs without message internals", () => {
    const mapped = searchThreadsFromList(toThreadListItems(FIXTURE_THREADS))

    expect(mapped[0]).toEqual({
      id: FIXTURE_THREADS[0]!.id,
      title: FIXTURE_THREADS[0]!.title,
      when: "Today",
    })
    expect(mapped[1]?.when).toBe("Yesterday")
    expect(mapped[2]?.when).toBe("Earlier")
    expect(mapped[0]).not.toHaveProperty("messages")
    expect(mapped[0]?.preview).toBeUndefined()
  })
})
