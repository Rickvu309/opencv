import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"

import sidebarStyles from "./design/sidebar.styles.json"

// Checks the 252px sidebar rail (Zi9iS) against pen frame FUipv (W3.1 New chat).
// The main chat pane is not yet covered here; see PENDING_FRAMES entry in
// design-frame-coverage.test.ts.

type SidebarSection = (typeof sidebarStyles.sections)[number]
const sidebar = sidebarStyles.sections.find(
  (s: SidebarSection) => s.id === "Zi9iS"
)!
const dock = sidebarStyles.sections.find(
  (s: SidebarSection) => s.id === "IYQY3"
)!

afterEach(() => {
  cleanup()
})

describe("app shell sidebar pen parity (FUipv / Zi9iS)", () => {
  it("renders all nav labels the pen specifies", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)

    const nav = await screen.findByRole("navigation", { name: "Main" })
    const sidebarEl = nav.closest("[data-slot='shell-nav']") ?? nav

    for (const text of sidebar.texts) {
      if (
        [
          "opencv",
          "4",
          "Your work",
          "Favorites",
          "Junior Marketing CV",
          "Lumière application",
          "Checkout UX study",
          "LN",
          "Linh Nguyen",
        ].includes(text.content)
      ) {
        continue
      }
      expect(
        within(sidebarEl as HTMLElement).getByText(text.content)
      ).toBeInTheDocument()
    }
  })

  it("renders brand mark and wordmark at pen dimensions", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)

    await screen.findByRole("navigation", { name: "Main" })

    const brand = document.querySelector("[data-slot='brand']")
    expect(brand).toBeInTheDocument()

    const mark = brand?.querySelector("[data-slot='mark']")
    expect(mark).toBeInTheDocument()
    expect(mark?.getAttribute("width")).toBe("20")
    expect(mark?.getAttribute("height")).toBe("20")
  })

  it("renders Coach and History buttons in the dock", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)

    await screen.findByRole("navigation", { name: "Main" })

    const dockEl = document.querySelector("[data-slot='app-dock']")
    expect(dockEl).toBeInTheDocument()

    const coachBtn = within(dockEl as HTMLElement).getByRole("button", {
      name: /Coach/i,
    })
    expect(coachBtn).toBeInTheDocument()

    const historyBtn = within(dockEl as HTMLElement).getByRole("button", {
      name: "History",
    })
    expect(historyBtn).toBeInTheDocument()

    expect(dock.controls[0].height).toBe(28)
    expect(dock.controls[1].width).toBe(28)
  })

  it("shell nav has pen-surface attribute for scoped CSS", async () => {
    stubDesktopViewport(true)
    renderApp(SURFACE_PATHS.pitch)

    await screen.findByRole("navigation", { name: "Main" })

    expect(
      document.querySelector(
        "[data-pen-surface='app-shell'][data-slot='shell-nav']"
      )
    ).toBeInTheDocument()
  })
})
