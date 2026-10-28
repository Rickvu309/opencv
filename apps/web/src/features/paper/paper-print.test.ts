// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { pagesFromPreviewHeight, readPreviewPageCount } from "./paper-print.ts"

describe("preview page count", () => {
  it("counts one page at the A4 height and two pages past it", () => {
    expect(pagesFromPreviewHeight(0, 1123)).toBe(1)
    expect(pagesFromPreviewHeight(1123, 1123)).toBe(1)
    expect(pagesFromPreviewHeight(1124, 1123)).toBe(2)
    expect(pagesFromPreviewHeight(2246, 1123)).toBe(2)
  })

  it("reads the element height against the A4 variable", () => {
    const node = document.createElement("div")
    Object.defineProperty(node, "scrollHeight", { value: 2246 })
    expect(readPreviewPageCount(node)).toBe(2)
    expect(readPreviewPageCount(null)).toBe(1)
  })
})
