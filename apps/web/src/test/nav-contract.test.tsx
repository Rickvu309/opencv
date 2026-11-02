import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor, within } from "@testing-library/react"

import { SHELL_PRIMARY, SHELL_WORK } from "@/features/app-shell/sidebar-nav.ts"
import { createAppRouter } from "@/router.tsx"
import { stubDesktopViewport } from "@/test/app-shell-fixtures.ts"
import pending from "@/test/nav-pending.json"
import { renderApp } from "@/test/render-app.tsx"
import {
  getMockPaperDocs,
  setMockPaperFavorite,
} from "@/test/paper-api-mock.ts"
import {
  resetShellApiMock,
  setMockInbox,
  setMockJobs,
} from "@/test/shell-api-mock.ts"

const ITEMS = [...SHELL_PRIMARY, ...SHELL_WORK]
const SAMPLE_ID = "11111111-1111-7111-8111-111111111111"

const owner = (path: string) =>
  ITEMS.find((item) => path === item.to || path.startsWith(`${item.to}/`))

const routes = Object.keys(createAppRouter().routesByPath).filter((path) =>
  owner(path)
)

async function failure(check: () => Promise<void>) {
  try {
    await check()
    return null
  } catch (error) {
    return error as Error
  }
}

beforeEach(() => {
  resetShellApiMock()
  stubDesktopViewport(true)
  vi.stubGlobal("scrollTo", vi.fn())
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe("sidebar nav contract", () => {
  it("finds a route under every nav item", () => {
    expect(routes.length).toBeGreaterThanOrEqual(ITEMS.length)
    for (const item of ITEMS) expect(routes).toContain(item.to)
  })

  it.each(routes)(
    "marks only the owning nav item current on %s",
    async (route) => {
      const item = owner(route)!
      const path = route.replace(/\$\w+/g, SAMPLE_ID)
      renderApp(path)
      const problem = await failure(async () => {
        const link = await screen.findByRole("link", { name: item.label })
        await waitFor(() =>
          expect(
            link,
            `${route} must mark ${item.label} current`
          ).toHaveAttribute("aria-current", "page")
        )
        const others = ITEMS.filter((other) => other.id !== item.id).map(
          (other) => screen.queryByRole("link", { name: other.label })
        )
        for (const other of others)
          expect(other?.getAttribute("aria-current") ?? null).toBeNull()
      })
      const entry = pending.find(
        (item) => item.rule === "active-state" && item.item === route
      )
      if (entry) {
        expect(
          problem,
          `${route} marks ${item.label} current now. Remove its active-state entry from apps/web/src/test/nav-pending.json.`
        ).not.toBeNull()
        return
      }
      if (problem)
        throw new Error(
          `${route}: ${problem.message}. Derive active from the route prefix in one place (activeOptions without exact: true), not per link.`
        )
    }
  )

  it.each(routes)("marks exactly one nav item current on %s", async (route) => {
    const path = route.replace(/\$\w+/g, SAMPLE_ID)
    renderApp(path)
    const sidebar = await screen.findByRole("complementary", {
      name: "Sidebar",
    })
    await waitFor(() =>
      expect(
        within(sidebar).getAllByRole("link", { current: "page" }),
        `${route} must mark exactly one nav item current`
      ).toHaveLength(1)
    )
  })

  it("marks only the favorite current on a favorite document's route", async () => {
    const doc = getMockPaperDocs().find((entry) => entry.kind === "cv")!
    setMockPaperFavorite(doc.id, true)
    renderApp(`/paper/${doc.id}`)
    const sidebar = await screen.findByRole("complementary", {
      name: "Sidebar",
    })
    const favorite = await within(sidebar).findByRole("link", {
      name: doc.name,
    })
    await waitFor(() =>
      expect(favorite).toHaveAttribute("aria-current", "page")
    )
    expect(
      within(sidebar).getAllByRole("link", { current: "page" }),
      "a favorite's route must mark only the favorite current, not its section"
    ).toEqual([favorite])
  })

  it("marks only the favorite current on a favorite job's route", async () => {
    setMockJobs([
      { id: "job-1", title: "Designer", company: "Acme", starred: true },
    ])
    renderApp("/apply/job-1")
    const sidebar = await screen.findByRole("complementary", {
      name: "Sidebar",
    })
    const favorite = await within(sidebar).findByRole("link", {
      name: "Designer Acme",
    })
    await waitFor(() =>
      expect(favorite).toHaveAttribute("aria-current", "page")
    )
    expect(
      within(sidebar).getAllByRole("link", { current: "page" }),
      "a favorite's route must mark only the favorite current, not its section"
    ).toEqual([favorite])
  })

  it("puts the count of every nav item in its accessible name", async () => {
    setMockInbox({
      connected: false,
      skipped: true,
      threads: [
        { id: "a", unread: true },
        { id: "b", unread: true },
      ],
    })
    renderApp(SHELL_PRIMARY[1].to)
    const inbox = await screen.findByRole("link", { name: /^Inbox/ })
    await waitFor(() => expect(inbox).toHaveTextContent("2"))
    const links = within(
      screen.getByRole("navigation", { name: "Main" })
    ).getAllByRole("link")
    const missing = links.flatMap((link) => {
      const badges = [...link.querySelectorAll('[aria-hidden="true"]')]
        .map((node) => node.textContent?.trim() ?? "")
        .filter(Boolean)
      const label = link.textContent?.replace(badges.join(""), "").trim() ?? ""
      const name = link.getAttribute("aria-label") ?? link.textContent ?? ""
      return badges
        .filter((badge) => !name.includes(badge))
        .map(
          (badge) =>
            `${label}: the count ${badge} is hidden from its accessible name "${name}". Drop the aria-label that overrides it or put the count in it, for example "Inbox, 2 unread".`
        )
    })
    const entries = pending.filter((entry) => entry.rule === "count-in-name")
    for (const entry of entries)
      expect(
        missing.some((line) => line.startsWith(`${entry.item}:`)),
        `${entry.item} has its count in its name now. Remove its count-in-name entry from apps/web/src/test/nav-pending.json.`
      ).toBe(true)
    expect(
      missing.filter(
        (line) => !entries.some((entry) => line.startsWith(`${entry.item}:`))
      )
    ).toEqual([])
  })
})
