import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { renderApp } from "@/test/render-app.tsx"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import { SURFACES, SURFACE_PATHS } from "@/lib/product-paths.ts"
import { getMockPaperDocs } from "@/test/paper-api-mock.ts"
import {
  resetShellApiMock,
  setMockInbox,
  setMockJobs,
} from "@/test/shell-api-mock.ts"

afterEach(() => {
  cleanup()
  resetShellApiMock()
  localStorage.clear()
})

async function renderSidebar(route: string) {
  stubDesktopViewport(true)
  renderApp(route)
  return screen.findByRole("complementary", { name: "Sidebar" })
}

function currentRows(sidebar: HTMLElement) {
  return within(sidebar)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.getAttribute("aria-label") ?? link.textContent)
}

describe("app sidebar rows follow the surface list", () => {
  it("shows each shown surface with a nav group and omits every other surface", async () => {
    const sidebar = await renderSidebar(SURFACE_PATHS.paper)
    await within(sidebar).findByRole("link", { name: "Paper" })
    const labels = within(sidebar)
      .getAllByRole("link")
      .map((link) => link.textContent?.replace(/\d+$/, "").trim())
    for (const surface of SURFACES) {
      expect(labels.includes(surface.label), surface.id).toBe(
        surface.shown && surface.nav !== null
      )
    }
  })
})

describe("app sidebar active row", () => {
  it("keeps Paper active on a document route", async () => {
    const doc = getMockPaperDocs()[0]!
    const sidebar = await renderSidebar(`${SURFACE_PATHS.paper}/${doc.id}`)
    expect(
      await within(sidebar).findByRole("link", { name: "Paper" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(sidebar).getByRole("link", { name: "Apply" })
    ).not.toHaveAttribute("aria-current")
  })

  it("keeps Apply active on a job route", async () => {
    setMockJobs([
      {
        id: "01900000-0000-7000-8000-0000000000b2",
        title: "Designer",
        company: "Acme",
        starred: false,
      },
    ])
    const sidebar = await renderSidebar(
      `${SURFACE_PATHS.apply}/01900000-0000-7000-8000-0000000000b2`
    )
    expect(
      await within(sidebar).findByRole("link", { name: "Apply" })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(sidebar).getByRole("link", { name: "Paper" })
    ).not.toHaveAttribute("aria-current")
  })

  it("marks only the surface on its own route", async () => {
    const sidebar = await renderSidebar(SURFACE_PATHS.pitch)
    await within(sidebar).findByRole("link", { name: "Pitch" })
    expect(currentRows(sidebar)).toEqual(["Pitch"])
  })
})

describe("app sidebar Inbox name", () => {
  it("includes the unread count", async () => {
    setMockInbox({
      connected: false,
      skipped: true,
      threads: [
        { id: "a", unread: true },
        { id: "b", unread: true },
        { id: "c", unread: true },
        { id: "d", unread: true },
      ],
    })
    const sidebar = await renderSidebar(SURFACE_PATHS.pitch)
    expect(
      await within(sidebar).findByRole("link", { name: "Inbox, 4 unread" })
    ).toHaveAccessibleName("Inbox, 4 unread")
  })

  it("is just Inbox when nothing is unread", async () => {
    const sidebar = await renderSidebar(SURFACE_PATHS.pitch)
    expect(
      await within(sidebar).findByRole("link", { name: "Inbox" })
    ).toHaveAccessibleName("Inbox")
  })
})

async function tabTo(
  user: ReturnType<typeof userEvent.setup>,
  target: HTMLElement
) {
  for (let step = 0; step < 40 && document.activeElement !== target; step += 1)
    await user.tab()
  expect(target).toHaveFocus()
}

describe("app sidebar groups", () => {
  it("collapses Your work from the keyboard and keeps it collapsed after a remount", async () => {
    const user = userEvent.setup()
    const sidebar = await renderSidebar(SURFACE_PATHS.pitch)
    const toggle = await within(sidebar).findByRole("button", {
      name: "Your work",
    })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(within(sidebar).getByRole("link", { name: "Apply" })).toBeVisible()

    await tabTo(user, toggle)
    await user.keyboard("{Enter}")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle).toHaveFocus()
    expect(within(sidebar).queryByRole("link", { name: "Apply" })).toBeNull()
    expect(within(sidebar).queryByRole("link", { name: "Paper" })).toBeNull()
    expect(within(sidebar).queryByRole("link", { name: "Pitch" })).toBeNull()

    cleanup()
    const reloaded = await renderSidebar(SURFACE_PATHS.pitch)
    const again = await within(reloaded).findByRole("button", {
      name: "Your work",
    })
    expect(again).toHaveAttribute("aria-expanded", "false")
    expect(within(reloaded).queryByRole("link", { name: "Apply" })).toBeNull()

    await tabTo(user, again)
    await user.keyboard(" ")
    expect(again).toHaveAttribute("aria-expanded", "true")
    expect(within(reloaded).getByRole("link", { name: "Apply" })).toBeVisible()
  })

  it("collapses Favorites from the keyboard and keeps it collapsed after a remount", async () => {
    setMockJobs([
      {
        id: "01900000-0000-7000-8000-0000000000b2",
        title: "Designer",
        company: "Acme",
        starred: true,
      },
    ])
    const user = userEvent.setup()
    const sidebar = await renderSidebar(SURFACE_PATHS.pitch)
    const toggle = await within(sidebar).findByRole("button", {
      name: "Favorites",
    })
    await within(sidebar).findByRole("link", { name: "Designer Acme" })

    await tabTo(user, toggle)
    await user.keyboard(" ")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(
      within(sidebar).queryByRole("link", { name: "Designer Acme" })
    ).toBeNull()
    expect(within(sidebar).getByRole("link", { name: "Apply" })).toBeVisible()

    cleanup()
    const reloaded = await renderSidebar(SURFACE_PATHS.pitch)
    const again = await within(reloaded).findByRole("button", {
      name: "Favorites",
    })
    expect(again).toHaveAttribute("aria-expanded", "false")
    expect(
      within(reloaded).queryByRole("link", { name: "Designer Acme" })
    ).toBeNull()

    await tabTo(user, again)
    await user.keyboard("{Enter}")
    expect(again).toHaveAttribute("aria-expanded", "true")
    expect(
      await within(reloaded).findByRole("link", { name: "Designer Acme" })
    ).toBeVisible()
  })
})
