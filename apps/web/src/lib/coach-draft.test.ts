import { afterEach, describe, expect, it, vi } from "vitest"

import {
  publishCoachDraft,
  subscribeCoachDraft,
  takeCoachDraft,
} from "./coach-draft.ts"

const nextTurn = () => new Promise<void>((resolve) => queueMicrotask(resolve))

afterEach(() => vi.useRealTimers())

describe("coach draft handoff", () => {
  it("tells every listener the text a block editor sends to the dock", () => {
    const heard: string[] = []
    const unsubscribe = subscribeCoachDraft((text) => heard.push(text))

    publishCoachDraft("Tighten this bullet")
    unsubscribe()
    publishCoachDraft("Not heard")

    expect(heard).toEqual(["Tighten this bullet"])
  })

  it("lets a Strict Mode second render in the same turn read the draft again", async () => {
    publishCoachDraft("Rewrite the summary")

    expect(takeCoachDraft()).toBe("Rewrite the summary")
    expect(takeCoachDraft()).toBe("Rewrite the summary")

    await nextTurn()
    expect(takeCoachDraft()).toBeNull()
  })

  it("drops a draft nobody read once its lifetime ends", () => {
    vi.useFakeTimers()
    publishCoachDraft("Unread draft")

    vi.advanceTimersByTime(500)

    expect(takeCoachDraft()).toBeNull()
  })
})
