import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectPaperDrive } from "@/test/paper-drive.ts"
import { renderApp } from "@/test/render-app.tsx"
import {
  expectCoachIdle,
  expectSendSettled,
  sendMessage,
} from "@/test/coach-chat-helpers.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Coach without the old history nav", () => {
  it("does not render a History navigation", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()
  })

  it("keeps the open chat after visiting Paper", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    await sendMessage("Should I finish my CV first?")
    await expectSendSettled("Should I finish my CV first?")

    fireEvent.click(screen.getByRole("link", { name: "Paper" }))
    await expectPaperDrive()
    fireEvent.click(screen.getByRole("link", { name: "Coach" }))

    expect(await screen.findByRole("log", { name: "Chat" })).toHaveTextContent(
      "Should I finish my CV first?"
    )
    expect(
      screen.queryByRole("navigation", { name: "History" })
    ).not.toBeInTheDocument()
  })
})
