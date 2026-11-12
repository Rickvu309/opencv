import { describe, expect, it } from "vitest"

import {
  SURFACES,
  isPathShown,
  isSurfaceShown,
  legacyAppPath,
  legacyPathname,
  shownSurfaces,
  startPageEntry,
  startPagePath,
  type SurfaceId,
} from "./product-paths.ts"
import { SHELL_PRIMARY, SHELL_WORK } from "@/features/app-shell/sidebar-nav.ts"

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
  it("maps shown start pages and sends hidden or unknown pages to Apply", () => {
    expect(startPagePath("apply")).toBe("/apply")
    expect(startPagePath("paper")).toBe("/paper")
    expect(startPagePath("coach")).toBe("/coach")
    expect(startPagePath("inbox")).toBe("/apply")
    expect(startPagePath("home")).toBe("/apply")
    expect(startPagePath(undefined)).toBe("/apply")
    expect(startPagePath(null)).toBe("/apply")
    expect(startPageEntry("home").label).toBe("Apply")
  })
})

describe("surface list contract", () => {
  it("contains every nav entry in SURFACES and only shown surfaces appear in nav", () => {
    const navItems = [...SHELL_PRIMARY, ...SHELL_WORK]
    const surfaceMap = new Map(SURFACES.map((s) => [s.id, s]))

    for (const item of navItems) {
      const surface = surfaceMap.get(item.id as SurfaceId)
      expect(surface).toBeDefined()
      expect(surface?.shown).toBe(true)
      expect(surface?.path).toBe(item.to)
    }

    const navIds = new Set(navItems.map((item) => item.id))
    expect(navIds.has("inbox")).toBe(false)
    expect(navIds.has("jobs")).toBe(false)
    expect(navIds.has("pitch")).toBe(false)
  })

  it("classifies every routed product path in SURFACES", () => {
    const productPaths = [
      "/paper",
      "/apply",
      "/coach",
      "/settings",
      "/pitch",
      "/jobs",
      "/proofs",
      "/inbox",
    ]

    for (const path of productPaths) {
      const match = SURFACES.find((s) => s.path === path)
      expect(match).toBeDefined()
    }
  })

  it("marks hidden surfaces as not shown and not reachable", () => {
    const hiddenIds: SurfaceId[] = ["pitch", "jobs", "proofs", "inbox"]
    for (const id of hiddenIds) {
      expect(isSurfaceShown(id)).toBe(false)
    }

    const shown = shownSurfaces().map((s) => s.id)
    expect(shown).toEqual(["coach", "paper", "apply", "settings", "help"])

    expect(isPathShown("/pitch")).toBe(false)
    expect(isPathShown("/jobs")).toBe(false)
    expect(isPathShown("/proofs")).toBe(false)
    expect(isPathShown("/inbox")).toBe(false)

    expect(isPathShown("/paper")).toBe(true)
    expect(isPathShown("/apply")).toBe(true)
    expect(isPathShown("/coach")).toBe(true)
    expect(isPathShown("/settings")).toBe(true)
    expect(isPathShown("/help")).toBe(true)
  })
})
