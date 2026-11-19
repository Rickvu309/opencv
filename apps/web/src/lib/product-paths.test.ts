import { createMemoryHistory } from "@tanstack/react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SHELL_PRIMARY, SHELL_WORK } from "@/features/app-shell/sidebar-nav.ts"
import { PALETTE_PAGES } from "@/features/command-palette/palette-search.ts"
import { createAppRouter } from "@/router.tsx"
import {
  setMockSession,
  TEST_SESSION,
  TEST_SESSION_USER,
} from "@/test/auth-client-mock.ts"
import {
  profileApiFetch,
  resetProfileApiMock,
} from "@/test/profile-api-mock.ts"
import {
  START_PAGES,
  SURFACES,
  isPathShown,
  isSurfaceShown,
  legacyAppPath,
  legacyPathname,
  shownSurfaces,
  startPageEntry,
  startPagePath,
} from "./product-paths.ts"

describe("legacy product paths", () => {
  it("strips only the app segment and keeps query and hash", () => {
    expect(legacyPathname("/app")).toBe("/")
    expect(legacyPathname("/app/")).toBe("/")
    expect(legacyPathname("/app/coach")).toBe("/coach")
    expect(legacyPathname("/app//example.com")).toBe("/example.com")
    expect(legacyPathname("/app/paper/doc")).toBe("/paper/doc")
    expect(legacyPathname("/apply")).toBeUndefined()
    expect(legacyPathname("/application")).toBeUndefined()
    expect(legacyPathname("/pricing")).toBeUndefined()
    expect(legacyPathname("/coach")).toBeUndefined()

    expect(legacyAppPath("/app/paper?doc=a%2Fb#page")).toBe(
      "/paper?doc=a%2Fb#page"
    )
    expect(legacyAppPath("/app?utm=a%2Fb#start")).toBe("/?utm=a%2Fb#start")
    expect(legacyAppPath("/apply")).toBeUndefined()
    expect(legacyAppPath("/application")).toBeUndefined()
    expect(legacyAppPath("/coach")).toBeUndefined()
  })
})

describe("startPagePath", () => {
  it("maps each offered start page to its path and anything else to Apply", () => {
    for (const surface of SURFACES) {
      const offered = surface.shown && surface.canBeStartPage
      expect(startPagePath(surface.id)).toBe(offered ? surface.path : "/apply")
    }
    expect(startPagePath("home")).toBe("/apply")
    expect(startPagePath(undefined)).toBe("/apply")
    expect(startPagePath(null)).toBe("/apply")
    expect(startPageEntry("home").label).toBe("Apply")
  })
})

const START_PATH = "/apply"
const navItems = [...SHELL_PRIMARY, ...SHELL_WORK]

describe.each(SURFACES.map((surface) => [surface.id, surface] as const))(
  "surface %s follows its shown flag",
  (_id, surface) => {
    const inNav = surface.shown && surface.nav !== null

    it(`${inNav ? "is" : "is not"} in the sidebar`, () => {
      const group = surface.nav === "primary" ? SHELL_PRIMARY : SHELL_WORK
      expect(group.some((item) => item.id === surface.id)).toBe(inNav)
      expect(navItems.some((item) => item.id === surface.id)).toBe(inNav)
    })

    beforeEach(() => {
      setMockSession({ user: TEST_SESSION_USER, session: TEST_SESSION })
      resetProfileApiMock()
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL, init?: RequestInit) =>
          (await profileApiFetch(input, init)) ??
          Response.json({ error: "not mocked" }, { status: 404 })
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it(`${surface.shown ? "opens" : "redirects to the start page"}`, async () => {
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [surface.path] }),
      })
      await router.load()
      const landed = router.state.location.pathname
      expect(isSurfaceShown(surface.id)).toBe(surface.shown)
      expect(isPathShown(surface.path)).toBe(surface.shown)
      if (!surface.shown) {
        expect(landed).toBe(START_PATH)
        return
      }
      expect(
        SURFACES.some((item) => item.shown && item.path === landed),
        landed
      ).toBe(true)
      if (surface.path !== START_PATH) expect(landed).not.toBe(START_PATH)
    })

    it(`${surface.shown && surface.inSearch ? "is" : "is not"} a search result`, () => {
      expect(PALETTE_PAGES.some((page) => page.surface === surface.id)).toBe(
        surface.shown && surface.inSearch
      )
    })

    it(`${surface.shown && surface.canBeStartPage ? "is" : "is not"} offered as a start page`, () => {
      expect(Object.hasOwn(START_PAGES, surface.id)).toBe(
        surface.shown && surface.canBeStartPage
      )
    })
  }
)

describe("surface list contract", () => {
  it("orders the sidebar rows inbox, coach, jobs, then paper, apply, pitch, proofs", () => {
    expect(SHELL_PRIMARY.map((item) => item.id)).toEqual([
      "inbox",
      "coach",
      "jobs",
    ])
    expect(SHELL_WORK.map((item) => item.id)).toEqual([
      "paper",
      "apply",
      "pitch",
      "proofs",
    ])
  })

  it("keeps paid plans hidden", () => {
    expect(isSurfaceShown("upgrade")).toBe(false)
    expect(isSurfaceShown("purchase")).toBe(false)
  })

  it("routes every product path through a SURFACES entry and routes every shown surface", () => {
    const router = createAppRouter()
    const routes = router.routesByPath
    const productRoutes = Object.keys(routes).filter(
      (routePath) =>
        routes[routePath as keyof typeof routes]?.parentRoute?.id === "/product"
    )
    expect(productRoutes.length).toBeGreaterThan(0)
    for (const routePath of productRoutes) {
      expect(
        SURFACES.some(
          (s) => routePath === s.path || routePath.startsWith(s.path)
        ),
        `expected ${routePath} to have a matching SURFACES entry`
      ).toBe(true)
    }
    for (const shown of shownSurfaces()) {
      expect(
        Object.keys(routes).some((r) => r.startsWith(shown.path)),
        `expected shown surface ${shown.id} (${shown.path}) to be routed`
      ).toBe(true)
    }
  })
})
