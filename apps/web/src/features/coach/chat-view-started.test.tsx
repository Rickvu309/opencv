import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { ChatView } from "@/features/coach/chat-view.tsx"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

const turn = {
  id: "user-1",
  role: "user" as const,
  text: "Test something",
}

function renderView(
  presentation: "page" | "compact",
  messages = [turn],
  startedAt: string | null = new Date().toISOString()
) {
  render(createElement(ChatView, { presentation, messages, startedAt }))
}

describe("ChatView start time", () => {
  it("dates a page Chat above its first message", () => {
    renderView("page")
    const stamp = screen.getByText(/^Today \d{1,2}:\d{2} [AP]M$/)
    expect(stamp.tagName).toBe("TIME")
    expect(
      stamp.compareDocumentPosition(screen.getByText("Test something")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("leaves the panel, an empty Chat and an unknown start undated", () => {
    renderView("compact")
    expect(screen.queryByText(/^Today/)).not.toBeInTheDocument()
    cleanup()
    renderView("page", [])
    expect(screen.queryByText(/^Today/)).not.toBeInTheDocument()
    cleanup()
    renderView("page", [turn], null)
    expect(screen.queryByText(/^Today/)).not.toBeInTheDocument()
  })
})
