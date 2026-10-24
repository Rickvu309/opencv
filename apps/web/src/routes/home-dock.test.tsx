import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { BROAD_SUGGESTIONS } from "@/features/home/suggestions.ts"
import {
  getLastCoachRequest,
  scriptCoachStream,
} from "@/test/threads-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const FOCUSABLE = "button:not([disabled]), textarea, input, [tabindex='0']"

async function findComposer() {
  return screen.findByRole("textbox", { name: "Message Coach" })
}

describe("Home Coach dock", () => {
  it("puts the composer first, with the placeholder Ask the Coach", async () => {
    renderApp()
    const composer = await findComposer()

    expect(composer).toHaveAttribute("placeholder", "Ask the Coach")
    const dock = composer.closest("[data-slot='coach-composer']")!
    expect(dock.querySelector(FOCUSABLE)).toBe(composer)

    const chip = screen.getByRole("button", { name: "Review my CV" })
    expect(
      composer.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("fills the composer with a suggestion's prompt and sends nothing", async () => {
    renderApp()
    const composer = await findComposer()

    const [first] = BROAD_SUGGESTIONS
    fireEvent.click(screen.getByRole("button", { name: first!.label }))

    expect(composer).toHaveValue(first!.prompt)
    expect(
      screen.queryByRole("log", { name: "Thread" })
    ).not.toBeInTheDocument()
  })

  it("sends on Enter and keeps Shift+Enter as a newline", async () => {
    scriptCoachStream({ texts: ["Got it."] })
    renderApp()
    const composer = await findComposer()

    fireEvent.change(composer, { target: { value: "Line one" } })
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true })
    expect(getLastCoachRequest()?.text).not.toBe("Line one")
    expect(
      screen.queryByRole("log", { name: "Thread" })
    ).not.toBeInTheDocument()

    fireEvent.keyDown(composer, { key: "Enter" })
    await waitFor(() => {
      expect(getLastCoachRequest()?.text).toBe("Line one")
    })
  })

  it("has no model menu and no voice control", async () => {
    renderApp()
    await findComposer()

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /model/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /voice/i })
    ).not.toBeInTheDocument()
  })
})
