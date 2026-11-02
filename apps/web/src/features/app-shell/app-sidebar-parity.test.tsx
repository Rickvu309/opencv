import { afterEach, describe, expect, it } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"

import { renderApp } from "@/test/render-app.tsx"
import {
  accountTrigger,
  openAccountMenu,
  stubDesktopViewport,
} from "@/test/app-shell-fixtures.ts"
import { SURFACE_PATHS } from "@/lib/product-paths.ts"
import {
  getMockPaperDocs,
  patchMockPaperDoc,
  setMockPaperFavorite,
} from "@/test/paper-api-mock.ts"
import {
  resetShellApiMock,
  setMockInbox,
  setMockJobs,
} from "@/test/shell-api-mock.ts"

import { profileInitials } from "./profile-display.ts"
import layout from "./design/app-sidebar.layout.json"
import snapshot from "./design/app-sidebar.snapshot.json"
import styles from "./design/app-sidebar.styles.json"

const NO_DATA = ["Checkout UX study"]
const PROFILE_TEXTS = ["LN", "Linh Nguyen"]

const penTexts = styles.sections.flatMap((section) =>
  section.texts.map((text) => text.content)
)

afterEach(() => {
  cleanup()
  resetShellApiMock()
  localStorage.clear()
})

async function renderSidebar(route: string = SURFACE_PATHS.pitch) {
  stubDesktopViewport(true)
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
  setMockJobs([
    {
      id: "job-lumiere",
      title: "Lumière application",
      company: "Lumière",
      starred: true,
    },
  ])
  const cv = getMockPaperDocs().find((doc) => doc.kind === "cv")!
  patchMockPaperDoc(cv.id, { name: "Junior Marketing CV" })
  setMockPaperFavorite(cv.id, true)
  renderApp(route)
  const sidebar = await screen.findByRole("complementary", { name: "Sidebar" })
  await within(sidebar).findByText("Lumière application")
  await within(sidebar).findByText("Junior Marketing CV")
  return sidebar
}

describe("app sidebar pen parity (YC0lV / jsloS)", () => {
  it("holds the frame and root the layout was recorded from", () => {
    expect(snapshot.source.root).toBe("jsloS")
    expect(layout.frameId).toBe(snapshot.source.frameId)
    expect(layout.pane).toEqual({ width: 244, height: 900 })
    expect(layout.texts.map((text) => text.text)).toEqual(penTexts)
  })

  it("shows every pen text the account has data for", async () => {
    const sidebar = await renderSidebar()
    const inbox = within(sidebar).getByRole("link", {
      name: "Inbox, 4 unread",
    })
    await waitFor(() => expect(inbox).toHaveTextContent("4"))
    for (const text of penTexts) {
      if (NO_DATA.includes(text)) continue
      if (PROFILE_TEXTS.includes(text)) continue
      expect(within(sidebar).getAllByText(text).length).toBeGreaterThan(0)
    }
  })

  it("leaves out the favorite the account cannot have yet", async () => {
    const sidebar = await renderSidebar()
    for (const text of NO_DATA)
      expect(within(sidebar).queryByText(text)).toBeNull()
  })

  it("lists the rows in the pen order", async () => {
    const sidebar = await renderSidebar()
    const rows = within(sidebar)
      .getAllByRole("link")
      .map((link) => link.textContent?.replace(/\d+$/, "").trim())
    expect(rows).toEqual([
      "Inbox",
      "Coach",
      "Jobs",
      "Paper",
      "Apply",
      "Pitch",
      "Junior Marketing CV",
      "Lumière application",
    ])
  })

  it("puts the chevron after the group label, as the pen draws it", async () => {
    const sidebar = await renderSidebar()
    for (const name of ["Your work", "Favorites"]) {
      const label = within(sidebar).getByRole("button", { name })
      expect(label.firstChild?.textContent).toBe(name)
      expect(label.lastElementChild?.tagName.toLowerCase()).toBe("svg")
      expect(label).toHaveAttribute("aria-expanded", "true")
    }
  })

  it("marks the current screen and nothing else as the active row", async () => {
    const sidebar = await renderSidebar(SURFACE_PATHS.pitch)
    const current = within(sidebar)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current.map((link) => link.textContent)).toEqual(["Pitch"])
  })

  it("sizes the brand mark, avatar and icons from the pen marks", async () => {
    const sidebar = await renderSidebar()
    const marks = styles.sections.flatMap((section) => section.marks)
    const logo = marks.find((mark) => mark.name === "Logo")!
    const mark = sidebar.querySelector("[data-slot='mark']")!
    expect(mark.getAttribute("width")).toBe(String(logo.width))
    expect(mark.getAttribute("height")).toBe(String(logo.height))
    expect(sidebar.querySelector("[data-slot='avatar']")).toHaveAttribute(
      "data-size",
      "sm"
    )
    const icon = sidebar.querySelector("[data-slot='sidebar-link'] svg")!
    expect(icon.getAttribute("class")).toContain("size-4")
  })

  it("shows the person's initials and name in the footer", async () => {
    const sidebar = await renderSidebar()
    const footer = sidebar.querySelector("[data-slot='shell-profile']")!
    const name = footer.querySelector(
      "[data-slot='account-name']"
    )!.textContent!
    expect(name.length).toBeGreaterThan(0)
    expect(footer.querySelector("[data-slot='avatar']")).toHaveTextContent(
      profileInitials(name)
    )
  })

  it("scopes the pen colors to the sidebar surface", async () => {
    const sidebar = await renderSidebar()
    expect(
      sidebar.querySelector("[data-pen-surface='app-shell']")
    ).not.toBeNull()
  })

  it("keeps the search, new chat and settings actions", async () => {
    const sidebar = await renderSidebar()
    expect(
      within(sidebar).getByRole("button", { name: "Search" })
    ).toBeInTheDocument()
    expect(
      within(sidebar).getByRole("button", { name: "New chat" })
    ).toBeInTheDocument()
    expect(accountTrigger()).toBeInTheDocument()
    expect(
      within(sidebar).queryByRole("link", { name: "Settings" })
    ).not.toBeInTheDocument()
    await openAccountMenu()
    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      SURFACE_PATHS.settings
    )
  })
})
