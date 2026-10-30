import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import { getLastCoachRequest, scriptCoachStream } from "@/test/chat-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function composer() {
  return screen.getByRole("textbox", { name: "Message Coach" })
}

describe("Coach composer", () => {
  it("fills the composer with a starter's text and sends nothing", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.click(screen.getByRole("button", { name: "Review my CV" }))

    expect(composer()).toHaveValue("Review my CV")
    expect(screen.queryByRole("log", { name: "Chat" })).not.toBeInTheDocument()
    expect(getLastCoachRequest()).toBeNull()
  })

  it("shows six starters and keeps the others behind More ideas", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    expect(
      screen.getByRole("button", { name: "Review my CV" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Compare two offers" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More ideas" }))

    fireEvent.click(screen.getByRole("button", { name: "Compare two offers" }))
    expect(composer()).toHaveValue("Compare two offers")
    expect(
      screen.queryByRole("button", { name: "Review my CV" })
    ).not.toBeInTheDocument()
  })

  it("sends on Enter and keeps Shift+Enter as a newline", async () => {
    scriptCoachStream({ texts: ["Got it."] })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.change(composer(), { target: { value: "Line one" } })
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true })
    expect(getLastCoachRequest()).toBeNull()
    expect(screen.queryByRole("log", { name: "Chat" })).not.toBeInTheDocument()

    fireEvent.keyDown(composer(), { key: "Enter" })
    await waitFor(() => {
      expect(getLastCoachRequest()?.text).toBe("Line one")
    })
  })

  it("lists the attach items in the Add menu and offers no voice control", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    expect(
      screen.queryByRole("button", { name: /voice/i })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    const menu = await screen.findByRole("menu")
    for (const label of [
      /^Upload a file/,
      "Add from Paper",
      "Add a job from Apply",
      "Paste a job link",
    ]) {
      expect(
        await screen.findByRole("menuitem", { name: label })
      ).toBeInTheDocument()
    }
    expect(menu).not.toHaveTextContent("Coming soon")
  })

  it("opens the Paper picker from Add from Paper", async () => {
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Add from Paper" })
    )

    expect(
      await screen.findByRole("dialog", { name: "Attach from Paper" })
    ).toBeInTheDocument()
  })
})
