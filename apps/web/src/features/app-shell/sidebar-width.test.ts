import { afterEach, describe, expect, it } from "vitest"

import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  isCollapseDrag,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  readSidebarCollapsed,
  readSidebarWidth,
  writeSidebarCollapsed,
  writeSidebarWidth,
} from "@/features/app-shell/sidebar-width.ts"

afterEach(() => localStorage.clear())

describe("sidebar width", () => {
  it("starts at the default width", () => {
    expect(readSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it("clamps to 216 and 360", () => {
    expect(clampSidebarWidth(120)).toBe(MIN_SIDEBAR_WIDTH)
    expect(clampSidebarWidth(215)).toBe(216)
    expect(clampSidebarWidth(280)).toBe(280)
    expect(clampSidebarWidth(361)).toBe(MAX_SIDEBAR_WIDTH)
    expect(clampSidebarWidth(Number.NaN)).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it("collapses a drag below 140 and not at 140", () => {
    expect(isCollapseDrag(139)).toBe(true)
    expect(isCollapseDrag(140)).toBe(false)
  })

  it("keeps the width between visits and clamps a stored value", () => {
    writeSidebarWidth(300)
    expect(readSidebarWidth()).toBe(300)
    localStorage.setItem("opencv.sidebar.width", "9000")
    expect(readSidebarWidth()).toBe(MAX_SIDEBAR_WIDTH)
    localStorage.setItem("opencv.sidebar.width", "junk")
    expect(readSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it("keeps the collapsed choice between visits", () => {
    expect(readSidebarCollapsed()).toBe(false)
    writeSidebarCollapsed(true)
    expect(readSidebarCollapsed()).toBe(true)
    writeSidebarCollapsed(false)
    expect(readSidebarCollapsed()).toBe(false)
  })
})
