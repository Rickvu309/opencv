import { readFileSync } from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  isCollapseDrag,
  isTypingTarget,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  readSidebarCollapsed,
  readSidebarWidth,
  writeSidebarCollapsed,
  writeSidebarWidth,
} from "@/features/app-shell/sidebar-width.ts"

afterEach(() => localStorage.clear())

describe("sidebar width", () => {
  it("starts at the pen width", () => {
    const layout = JSON.parse(
      readFileSync(
        path.resolve(
          process.cwd(),
          "src/features/app-shell/design/app-sidebar.layout.json"
        ),
        "utf8"
      )
    ) as { pane: { width: number } }
    expect(layout.pane.width).toBe(DEFAULT_SIDEBAR_WIDTH)
    expect(readSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  it("clamps to 200 and 360", () => {
    expect(clampSidebarWidth(120)).toBe(MIN_SIDEBAR_WIDTH)
    expect(clampSidebarWidth(199)).toBe(200)
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

  it("treats inputs and editors as typing", () => {
    const input = document.createElement("input")
    const editor = document.createElement("div")
    editor.setAttribute("contenteditable", "true")
    const inner = document.createElement("span")
    editor.append(inner)
    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(inner)).toBe(true)
    expect(isTypingTarget(document.createElement("button"))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
