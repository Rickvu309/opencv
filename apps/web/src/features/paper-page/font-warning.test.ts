import { expect, it } from "vitest"

import { fontFacesFromXml, fontWarning } from "./font-warning.ts"

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

it("names each replacement and refuses a generic font sentence", () => {
  const notice = fontWarning([
    { family: "Calibri", weight: "regular" },
    { family: "Century Gothic", weight: "regular" },
    { family: "Symbol", weight: "regular" },
    { family: "Montserrat", weight: "Light" },
    { family: "Open Sans", weight: "regular" },
    { family: "Courier New", weight: "regular" },
    { family: "Times New Roman", weight: "regular" },
    { family: "Aptos", weight: "regular" },
    { family: "Wingdings", weight: "regular" },
  ])
  expect(notice).toContain(
    "Calibri is shown using Carlito (metric-compatible)."
  )
  expect(notice).toContain(
    "Century Gothic is shown using Jost (different metrics)."
  )
  expect(notice).toContain("Symbol is shown using no shipped file.")
  expect(notice).toContain(
    "Montserrat Light is shown using Montserrat (Light instance not certified)."
  )
  expect(notice).toContain("Open Sans is the original font.")
  expect(notice).toContain(
    "Courier New is shown using Liberation Mono (metric-compatible)."
  )
  expect(notice).toContain(
    "Times New Roman is shown using Liberation Serif (metric-compatible)."
  )
  expect(notice).toContain(
    "Aptos is shown using Liberation Sans (no certified equivalent)."
  )
  expect(notice).toContain("Wingdings is shown using no shipped file.")
  expect(notice).not.toContain("Fonts substituted")
})

it("reads the typeface from the word markup", () => {
  const xml = `<w:document xmlns:w="${W}"><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/></w:document>`
  expect(fontWarning(fontFacesFromXml([xml]))).toBe(
    "Georgia is shown using Liberation Serif (no certified equivalent)."
  )
})
