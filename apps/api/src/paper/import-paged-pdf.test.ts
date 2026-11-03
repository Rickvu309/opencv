import { describe, expect, it } from "vitest"

import { pagedPdf } from "./import-fixtures.test.js"

describe("paged pdf fixtures", () => {
  it("builds one page per string, and a blank page for an empty string", () => {
    const two = pagedPdf(["A", "B"]).toString("utf8")
    expect(two).toContain("/Count 2")
    const blank = pagedPdf([""]).toString("utf8")
    expect(blank).toContain("/Count 1")
    expect(blank).not.toContain("Tj")
  })
})
