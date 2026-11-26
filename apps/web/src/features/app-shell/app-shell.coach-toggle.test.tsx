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
import {
  expectApplyLive,
  stubDesktopViewport,
} from "@/test/app-shell-fixtures.ts"
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
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()

    expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    expect(coachButton()).toHaveAttribute("aria-controls", "coach-panel")

    await openCoach()
    expect(coachButton()).toHaveAttribute("aria-expanded", "true")
    expect(document.getElementById("coach-panel")).toBeVisible()
    expect(document.getElementById("coach-panel")).toHaveFocus()

    fireEvent.click(coachButton())
    expect(document.getElementById("coach-panel")).toHaveAttribute(
      "data-closing"
    )
    await waitFor(() => {
      expect(document.getElementById("coach-panel")).toHaveAttribute("hidden")
    })
    expect(coachButton()).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("textbox", { name: "Message Coach" })).toBeNull()
    expect(coachButton()).toHaveAccessibleName("Coach")

    await openCoach()
    expect(coachButton()).toHaveAttribute("aria-expanded", "true")
  })

  it("puts focus back on the button when the click closes the panel", async () => {
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
    await openCoach()
    screen.getByRole("textbox", { name: "Message Coach" }).focus()

    fireEvent.click(coachButton())
    await waitFor(() => {
      expect(coachButton()).toHaveFocus()
    })
  })

  it("closes on Escape from the panel and puts focus back on the button", async () => {
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
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
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
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

  describe.each([
    [
      "the X button",
      () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
    ],
    [
      "Escape",
      () =>
        fireEvent.keyDown(
          screen.getByRole("textbox", { name: "Message Coach" }),
          { key: "Escape" }
        ),
    ],
    ["the footer button", () => fireEvent.click(coachButton())],
  ])("closing with %s", (_name, close) => {
    it("keeps the draft, and puts focus on the footer Coach button", async () => {
      renderApp(SURFACE_PATHS.apply)
      await expectApplyLive()
      const box = await openCoach()
      fireEvent.change(box, { target: { value: "Keep me" } })

      close()
      expect(document.getElementById("coach-panel")).toHaveAttribute(
        "data-closing"
      )
      await waitFor(() => {
        expect(document.getElementById("coach-panel")).toHaveAttribute("hidden")
      })
      expect(coachButton()).toHaveAttribute("aria-expanded", "false")
      expect(coachButton()).toHaveFocus()
      expect(
        screen.queryByRole("textbox", { name: "Message Coach" })
      ).toBeNull()

      fireEvent.click(coachButton())
      expect(
        await screen.findByRole("textbox", { name: "Message Coach" })
      ).toHaveValue("Keep me")
    })
  })

  it("keeps a running turn streaming while closed and shows it on reopen", async () => {
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
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
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
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

describe("Coach sheet keyboard access", () => {
  it("contains focus on phone and returns it to the launcher", async () => {
    stubDesktopViewport(false)
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
    await openCoach()
    const sheet = screen.getByRole("dialog", { name: "Coach" })
    expect(sheet).toHaveFocus()
    expect(sheet).toHaveAttribute("aria-modal", "true")
    expect(document.getElementById("app-main")?.parentElement).toHaveAttribute(
      "inert"
    )
    fireEvent.keyDown(sheet, { key: "Tab", shiftKey: true })
    const last = sheet.querySelectorAll("button")
    expect(last[last.length - 1]).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: "Tab" })
    expect(
      within(sheet).getByRole("button", { name: /^History,/ })
    ).toHaveFocus()
    fireEvent.keyDown(sheet, { key: "Escape" })
    await waitFor(() => expect(coachButton()).toHaveFocus())
    expect(screen.queryByRole("dialog", { name: "Coach" })).toBeNull()
  })

  it("fits the sheet to the visible viewport when the keyboard opens", async () => {
    stubDesktopViewport(false)
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
    })
    vi.stubGlobal("visualViewport", viewport)
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
    await openCoach()
    const sheet = screen.getByRole("dialog", { name: "Coach" })
    expect(sheet.style.height).toBe("844px")
    act(() => {
      viewport.height = 480
      viewport.offsetTop = 24
      viewport.dispatchEvent(new Event("resize"))
    })
    expect(sheet.style.height).toBe("480px")
    expect(sheet.style.top).toBe("24px")
    fireEvent.keyDown(sheet, { key: "Escape" })
    expect(sheet).toHaveAttribute("data-closing")
    expect(sheet.style.height).toBe("480px")
    expect(sheet.style.top).toBe("24px")
    await waitFor(() => {
      expect(sheet.style.height).toBe("")
      expect(sheet.style.top).toBe("")
    })
    vi.unstubAllGlobals()
  })

  it("leaves the desktop page interactive while Coach is open", async () => {
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
    await openCoach()
    expect(
      document.getElementById("app-main")?.parentElement
    ).not.toHaveAttribute("inert")
    expect(document.getElementById("app-main")).not.toHaveAttribute("hidden")
    expect(screen.queryByRole("dialog", { name: "Coach" })).toBeNull()
  })

  it("keeps history on the Coach page but leaves recent chats to the page and hides the Coach toggle", async () => {
    setMockChats([
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "CV vs internship first",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    const { router } = renderApp(SURFACE_PATHS.coach)
    await screen.findByRole("navigation", { name: "Main" })
    const dock = () =>
      document.querySelector('[data-slot="app-dock"]') as HTMLElement
    expect(dock()).toHaveAttribute("data-coach-page", "")
    expect(
      within(dock()).getByRole("button", { name: "History" })
    ).toBeInTheDocument()
    expect(
      within(dock()).queryByRole("button", { name: "CV vs internship first" })
    ).toBeNull()
    expect(within(dock()).queryByRole("button", { name: "Coach" })).toBeNull()
    await act(() => router.navigate({ to: SURFACE_PATHS.paper }))
    expect(
      await within(dock()).findByRole("button", {
        name: "CV vs internship first",
      })
    ).toBeInTheDocument()
    fireEvent.click(
      await within(dock()).findByRole("button", { name: "Coach" })
    )
    await screen.findByRole("region", { name: "Coach" })
    await act(() => router.navigate({ to: SURFACE_PATHS.coach }))
    expect(screen.queryByRole("region", { name: "Coach" })).toBeNull()
  })
})

function mainColumnLayout() {
  const classes: string[] = []
  let node: HTMLElement | null = document.getElementById("app-main")
  while (node && node.dataset.slot !== "app-shell") {
    classes.push(`${node.tagName}.${node.className}|${node.style.cssText}`)
    node = node.parentElement
  }
  return classes
}

describe("the main content beside the Coach card at desktop width", () => {
  it("keeps the same width and position whether the card is open or closed", async () => {
    renderApp(SURFACE_PATHS.apply)
    await expectApplyLive()
    const main = document.getElementById("app-main")
    expect(main?.className.split(" ")).toContain("flex-1")
    expect(main?.parentElement?.className.split(" ")).toContain("flex")
    const closed = mainColumnLayout()

    await openCoach()
    const card = document.getElementById("coach-panel")
    expect(card?.className.split(" ")).toContain("fixed")
    expect(card?.contains(main ?? null)).toBe(false)
    expect(mainColumnLayout()).toEqual(closed)
  })
})
