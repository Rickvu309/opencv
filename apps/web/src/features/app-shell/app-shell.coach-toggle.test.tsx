import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import { expectPitch, stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { liveTurn, step } from "@/test/live-turn.ts"
import { renderApp } from "@/test/render-app.tsx"
import { resetShellApiMock, setMockChats } from "@/test/shell-api-mock.ts"

beforeEach(() => {
  sessionStorage.clear()
  stubDesktopViewport(true)
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  resetShellApiMock()
})

function coachButton() {
  return screen.getByRole("button", { name: "Coach" })
}

async function openCoach() {
  fireEvent.click(coachButton())
  return screen.findByRole("textbox", { name: "Message Coach" })
}

describe("the Coach button in the dock", () => {
  it("opens on one click and closes on the next, and says which", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()

    expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    expect(coachButton()).toHaveAttribute("aria-controls", "coach-panel")

    await openCoach()
    expect(coachButton()).toHaveAttribute("aria-expanded", "true")
    expect(document.getElementById("coach-panel")).toBeVisible()

    fireEvent.click(coachButton())
    await waitFor(() => {
      expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    })
    expect(screen.queryByRole("textbox", { name: "Message Coach" })).toBeNull()
    expect(coachButton()).toHaveAccessibleName("Coach")

    await openCoach()
    expect(coachButton()).toHaveAttribute("aria-expanded", "true")
  })

  it("puts focus back on the button when the click closes the panel", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    await openCoach()
    screen.getByRole("textbox", { name: "Message Coach" }).focus()

    fireEvent.click(coachButton())
    await waitFor(() => {
      expect(coachButton()).toHaveFocus()
    })
  })

  it("closes on Escape from the panel and puts focus back on the button", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    await openCoach()
    screen.getByRole("textbox", { name: "Message Coach" }).focus()

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Message Coach" }), {
      key: "Escape",
    })
    await waitFor(() => {
      expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    })
    expect(coachButton()).toHaveFocus()
  })

  it("keeps a typed draft when the button closes and reopens the panel", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    const box = await openCoach()
    fireEvent.change(box, { target: { value: "Half a thought" } })

    fireEvent.click(coachButton())
    await waitFor(() => {
      expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    })
    fireEvent.click(coachButton())
    expect(
      await screen.findByRole("textbox", { name: "Message Coach" })
    ).toHaveValue("Half a thought")
  })

  it("keeps a running turn streaming while closed and shows it on reopen", async () => {
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    const prior = globalThis.fetch
    const turn = liveTurn()
    const live = globalThis.fetch
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method ?? "GET").toUpperCase() === "POST" &&
      /\/api\/chats\/[^/]+\/turns/.test(String(input))
        ? live(input, init)
        : prior(input, init)
    )

    const box = await openCoach()
    fireEvent.change(box, { target: { value: "Check my week" } })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await act(async () => {
      turn.emit("message-start", { chatId: "c" })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    fireEvent.click(coachButton())
    await waitFor(() => {
      expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    })
    const progress = step("List documents")
    await act(async () => {
      turn.emit(progress.event, progress.data)
      turn.emit("text-delta", { text: "Here is your week" })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    fireEvent.click(coachButton())
    await screen.findByRole("textbox", { name: "Message Coach" })
    const panel = document.getElementById("coach-panel")!
    expect(within(panel).getByRole("log", { name: "Chat" })).toHaveTextContent(
      "Check my week"
    )
    expect(
      within(panel).getByRole("button", { name: "Stop" })
    ).toBeInTheDocument()
  })

  it("opens a recent chat from its chip, and a chip never closes a different chat", async () => {
    setMockChats([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "CV vs internship first",
        focusKind: null,
        focusId: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.pitch)
    await expectPitch()
    await openCoach()
    expect(coachButton()).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(
      await screen.findByRole("button", { name: "CV vs internship first" })
    )
    expect(
      await screen.findByRole("region", { name: "CV vs internship first" })
    ).toBeInTheDocument()
    expect(coachButton()).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(coachButton())
    await waitFor(() => {
      expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    })
    expect(coachButton()).toHaveFocus()
  })
})
