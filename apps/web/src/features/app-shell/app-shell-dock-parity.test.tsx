import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"

import { setMockChats, resetShellApiMock } from "@/test/shell-api-mock.ts"
import { renderApp } from "@/test/render-app.tsx"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

import dockStyles from "./design/dock.styles.json"

type Section = (typeof dockStyles.sections)[number]
const dock = dockStyles.sections.find((s: Section) => s.id === "IYQY3")!

afterEach(() => {
  cleanup()
  resetShellApiMock()
})

describe("app shell dock pen parity (FUipv / IYQY3)", () => {
  it("renders Coach and History buttons in the dock", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)

    await screen.findByRole("navigation", { name: "Main" })

    const dockEl = document.querySelector("[data-slot='app-dock']")
    expect(dockEl).toBeInTheDocument()

    expect(
      within(dockEl as HTMLElement).getByRole("button", { name: /Coach/i })
    ).toBeInTheDocument()
    expect(
      within(dockEl as HTMLElement).getByRole("button", { name: "History" })
    ).toBeInTheDocument()

    expect(dock.controls[0].height).toBe(28)
    expect(dock.controls[1].width).toBe(28)
  })

  it("the dock has the pen-surface attribute for scoped CSS", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)

    await screen.findByRole("navigation", { name: "Main" })

    expect(
      document.querySelector(
        "[data-pen-surface='app-shell'][data-slot='app-dock']"
      )
    ).toBeInTheDocument()
  })
})

describe("Coach dock release layout", () => {
  it.each(["/coach", "/coach?chat=chat-1"])(
    "omits the dock on %s",
    async (path) => {
      stubDesktopViewport(true)
      renderApp(path)
      await screen.findByRole("navigation", { name: "Main" })
      expect(document.querySelector('[data-slot="app-dock"]')).toBeNull()
    }
  )

  it("keeps only the launcher and history when saved chats exist", async () => {
    stubDesktopViewport(true)
    setMockChats([
      {
        id: "chat-1",
        title: "Tighten my summary",
        focusKind: null,
        focusId: null,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
    ])
    renderApp(SURFACE_PATHS.apply)
    await screen.findByRole("navigation", { name: "Main" })
    const dock = document.querySelector<HTMLElement>('[data-slot="app-dock"]')!
    expect(
      within(dock)
        .getAllByRole("button")
        .map(
          (button) => button.textContent || button.getAttribute("aria-label")
        )
    ).toEqual(["Coach", "History"])
    expect(within(dock).queryByText("Tighten my summary")).toBeNull()
  })
})
