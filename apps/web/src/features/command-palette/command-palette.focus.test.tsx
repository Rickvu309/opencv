import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { focusSearchButton } from "./command-palette.tsx"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe("search button focus", () => {
  it("does nothing when the document is gone before the timer fires", () => {
    focusSearchButton()
    vi.stubGlobal("document", undefined)

    expect(() => vi.advanceTimersByTime(30)).not.toThrow()
  })

  it("returns focus to the Search button after closing", () => {
    const button = document.createElement("button")
    button.setAttribute("aria-label", "Search")
    document.body.append(button)

    focusSearchButton()
    vi.advanceTimersByTime(30)

    expect(button).toHaveFocus()
  })

  it("allows closing effect cleanup to cancel pending focus", () => {
    const button = document.createElement("button")
    button.setAttribute("aria-label", "Search")
    document.body.append(button)

    const cancel = focusSearchButton()
    cancel()
    vi.advanceTimersByTime(30)

    expect(button).not.toHaveFocus()
    expect(vi.getTimerCount()).toBe(0)
  })
})
