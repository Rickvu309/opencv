import { expect, it } from "vitest"

import editorCss from "./paper-editor.css?raw"
import { PAPER_FACES, faceStyle } from "./paper-faces.ts"

it("defines Paper fonts once, in the face table and not in the editor stylesheet", () => {
  expect(editorCss).not.toMatch(/@font-face/)
  const ids = PAPER_FACES.map(
    (face) => `${face.family} ${face.weight} ${face.style}`
  )
  expect(new Set(ids).size).toBe(PAPER_FACES.length)
})

it("has a face for every regular, bold and italic key the painter draws with", () => {
  for (const family of [
    "liberation-sans",
    "liberation-serif",
    "liberation-mono",
  ])
    for (const variant of ["regular", "bold", "italic", "bold-italic"]) {
      const style = faceStyle(`${family}-${variant}`)
      expect(
        PAPER_FACES.some(
          (face) =>
            face.family === style.family &&
            face.weight === style.weight &&
            face.style === style.style
        )
      ).toBe(true)
    }
  expect(
    PAPER_FACES.some((face) => face.family === faceStyle("carlito").family)
  ).toBe(true)
})
