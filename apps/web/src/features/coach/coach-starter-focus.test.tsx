import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { renderApp } from "@/test/render-app.tsx"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { COACH_STARTERS } from "./coach-starters.ts"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Coach starters", () => {
  it("puts the starter in the composer with focus and the caret at its end, without sending", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()
    const starter = COACH_STARTERS[0]!
    fireEvent.click(screen.getByRole("button", { name: starter.title }))
    const composer = screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Message Coach",
    })
    expect(composer).toHaveValue(starter.title)
    await waitFor(() => expect(composer).toHaveFocus())
    expect(composer.selectionStart).toBe(starter.title.length)
    expect(composer.selectionEnd).toBe(starter.title.length)
    expect(screen.queryByText(/Worked for/)).toBeNull()
  })
})
