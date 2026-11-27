import { expect, it } from "vitest"

import { faceKey, paperFontMetrics } from "@workspace/paper-engine"

import { cardFaceHeights } from "./card-faces.ts"

const FAMILIES = [
  "Liberation Sans",
  "Liberation Serif",
  "Liberation Mono",
  "Carlito",
  "Unknown Face",
]

it("gives every face the same ascent and descent as the Paper layout", () => {
  for (const family of FAMILIES)
    for (const bold of [false, true])
      for (const italic of [false, true]) {
        const key = faceKey(family, bold, italic)
        const { ascent, descent } = paperFontMetrics.face(key)
        expect(cardFaceHeights.face(key), key).toEqual({ ascent, descent })
      }
  const fallback = paperFontMetrics.face("no-such-face")
  expect(cardFaceHeights.face("no-such-face")).toEqual({
    ascent: fallback.ascent,
    descent: fallback.descent,
  })
})
