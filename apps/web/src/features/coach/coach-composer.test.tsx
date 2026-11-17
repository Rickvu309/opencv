import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectCoachIdle } from "@/test/coach-chat-helpers.ts"
import {
  getLastCoachRequest,
  scriptCoachStream,
  setMockChats,
} from "@/test/chat-api-mock.ts"
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
    setMockChats([])
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.click(screen.getByRole("button", { name: "Review my CV" }))

    expect(composer()).toHaveValue("Review my CV")
    expect(screen.queryByRole("log", { name: "Chat" })).not.toBeInTheDocument()
    expect(getLastCoachRequest()).toBeNull()
  })

  it("shows three starters the Coach can do and none that need job search", async () => {
    setMockChats([])
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    const ideas = screen.getByRole("list", { name: "Ideas for Coach" })
    expect(
      within(ideas)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["Review my CV", "Write a cover letter", "Prep an interview"])
    for (const name of [
      "Find roles",
      "Companies hiring now",
      "Improve my LinkedIn",
      "More ideas",
    ])
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Prep an interview" }))
    expect(composer()).toHaveValue("Prep an interview")
  })

  it("keeps the reply going when a double click on Send lands on Stop", async () => {
    const stream = scriptCoachStream({ gated: true, texts: ["Got it."] })
    renderApp(SURFACE_PATHS.coach)
    await expectCoachIdle()

    fireEvent.change(composer(), { target: { value: "Review my CV" } })
    const send = screen.getByRole("button", { name: "Send" })
    fireEvent.click(send, { detail: 1 })
    const stop = await screen.findByRole("button", { name: "Stop" })
    await waitFor(() => expect(getLastCoachRequest()).not.toBeNull())
    stream.release()
    await waitFor(() => expect(stream.emitted()).toBeGreaterThan(0))
    fireEvent.click(stop, { detail: 2 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stop" }), {
      detail: 1,
    })
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Stop" })
      ).not.toBeInTheDocument()
    )
    stream.releaseAll()
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
