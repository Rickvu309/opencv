// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { A4_HEIGHT_PX, readA4HeightPx } from "./paper-cv-a4.tsx"

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
