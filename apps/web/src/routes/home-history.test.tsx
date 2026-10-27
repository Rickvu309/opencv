import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { expectPaperDrive } from "@/test/paper-drive.ts"
import { goHome } from "@/test/go-home.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectHomeIdle,
  expectSendSettled,
  sendMessage,
} from "@/test/home-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Home without the old history nav", () => {
  it("does not render a History navigation", async () => {
    renderApp()
    await expectHomeIdle()
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()
  })

  it("keeps the open chat after visiting Paper", async () => {
    renderApp()
    await expectHomeIdle()
    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    await goHome()

    expect(screen.getByRole("log", { name: "Chat" })).toHaveTextContent(
      "Should I finish my CV first?"
    )
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()
  })
})
