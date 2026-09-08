// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  readA4FitScale,
  readA4FitWidth,
  readA4HeightPx,
} from "./paper-cv-a4.tsx"

describe("readA4HeightPx", () => {
  it("falls back when the CSS variable is unset", () => {
    expect(readA4HeightPx()).toBe(A4_HEIGHT_PX)
    expect(A4_HEIGHT_PX).toBe(1123)
  })

  it("reads --cv-page-height from the given element", () => {
    const node = document.createElement("div")
    node.style.setProperty("--cv-page-height", "900px")
    document.body.append(node)
    expect(readA4HeightPx(node)).toBe(900)
    node.remove()
  })
})

describe("readA4FitWidth (QVE-208)", () => {
  it("keeps the natural A4 width when the frame is unknown", () => {
    expect(readA4FitWidth(0, A4_WIDTH_PX)).toBe(A4_WIDTH_PX)
    expect(readA4FitScale(0, A4_WIDTH_PX)).toBe(1)
  })

  it("fits a café phone frame without upscaling", () => {
    expect(readA4FitWidth(360, A4_WIDTH_PX)).toBe(360)
    expect(readA4FitScale(360, A4_WIDTH_PX)).toBeCloseTo(360 / A4_WIDTH_PX)
    expect(readA4FitWidth(1200, A4_WIDTH_PX)).toBe(A4_WIDTH_PX)
    expect(readA4FitScale(1200, A4_WIDTH_PX)).toBe(1)
  })
})
