import { afterEach, describe, expect, it } from "vitest"

import {
  SEED_THREADS,
  STUB_COACH_REPLY,
  THREAD_STORAGE_KEY,
  emptyThreadState,
  readPersistedThreads,
  titleFrom,
  writePersistedThreads,
} from "@/features/home/threads.ts"

afterEach(() => {
  sessionStorage.clear()
})

describe("titleFrom", () => {
  it("keeps short text and trims long titles", () => {
    expect(titleFrom("  Help me plan the week  ")).toBe("Help me plan the week")
    expect(titleFrom("x".repeat(40))).toBe(`${"x".repeat(36)}…`)
  })
})

describe("stub Coach reply", () => {
  it("does not claim a Paper, Apply, or Command action", () => {
    expect(STUB_COACH_REPLY).toMatch(/haven't edited Paper or Apply/i)
    expect(STUB_COACH_REPLY).toMatch(/haven't run any Commands/i)
    expect(STUB_COACH_REPLY).not.toMatch(
      /\bI (have|'ve|just) (edited|updated|ran)\b/i
    )
  })
})

describe("thread persistence", () => {
  it("round-trips sessionStorage and rejects junk", () => {
    const state = {
      ...emptyThreadState(),
      activeThreadId: SEED_THREADS[0]!.id,
      messages: SEED_THREADS[0]!.messages,
    }

    writePersistedThreads(state)
    expect(readPersistedThreads()).toEqual(state)

    sessionStorage.setItem(THREAD_STORAGE_KEY, "{not-json")
    expect(readPersistedThreads()).toBeNull()

    sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify({ threads: [] }))
    expect(readPersistedThreads()).toBeNull()
  })
})
