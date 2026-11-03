import { describe, expect, it } from "vitest"

import { previewTemplate, printLayout } from "./paper-templates.ts"

describe("printLayout", () => {
  it("maps a design id and a codec id already stored on the document", () => {
    expect(printLayout("modern")).toBe("product")
    expect(printLayout("product")).toBe("product")
    expect(printLayout("compact")).toBe("service")
    expect(printLayout("service")).toBe("service")
    expect(printLayout("academic")).toBe("academic")
    expect(printLayout("with-photo")).toBe("photo")
    expect(printLayout("photo")).toBe("photo")
    expect(printLayout("internship")).toBe("internship")
    expect(printLayout(null)).toBe("internship")
  })
})

describe("previewTemplate", () => {
  it("uses the gallery id and reuses simple for an unsupported id", () => {
    expect(previewTemplate("modern")).toBe("modern")
    expect(previewTemplate("product")).toBe("modern")
    expect(previewTemplate("compact")).toBe("compact")
    expect(previewTemplate("service")).toBe("compact")
    expect(previewTemplate("academic")).toBe("academic")
    expect(previewTemplate("with-photo")).toBe("with-photo")
    expect(previewTemplate("photo")).toBe("with-photo")
    expect(previewTemplate("nope")).toBe("simple")
    expect(previewTemplate(null)).toBe("simple")
  })
})
