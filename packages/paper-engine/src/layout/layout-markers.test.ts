import { describe, expect, it } from "vitest"

import carlitoRegular from "@workspace/paper-fonts/metrics/carlito-regular.json" with { type: "json" }
import monoBoldItalic from "@workspace/paper-fonts/metrics/liberation-mono-bold-italic.json" with { type: "json" }
import monoBold from "@workspace/paper-fonts/metrics/liberation-mono-bold.json" with { type: "json" }
import monoItalic from "@workspace/paper-fonts/metrics/liberation-mono-italic.json" with { type: "json" }
import monoRegular from "@workspace/paper-fonts/metrics/liberation-mono-regular.json" with { type: "json" }
import sansBoldItalic from "@workspace/paper-fonts/metrics/liberation-sans-bold-italic.json" with { type: "json" }
import sansBold from "@workspace/paper-fonts/metrics/liberation-sans-bold.json" with { type: "json" }
import sansItalic from "@workspace/paper-fonts/metrics/liberation-sans-italic.json" with { type: "json" }
import sansRegular from "@workspace/paper-fonts/metrics/liberation-sans-regular.json" with { type: "json" }
import serifBoldItalic from "@workspace/paper-fonts/metrics/liberation-serif-bold-italic.json" with { type: "json" }
import serifBold from "@workspace/paper-fonts/metrics/liberation-serif-bold.json" with { type: "json" }
import serifItalic from "@workspace/paper-fonts/metrics/liberation-serif-italic.json" with { type: "json" }
import serifRegular from "@workspace/paper-fonts/metrics/liberation-serif-regular.json" with { type: "json" }

import type { BlockShape } from "./block-shape.js"
import { nextCounters, numberLabel } from "./paginate.js"

type FaceAdvances = { face: string; advances: Record<string, number> }

const faces: readonly FaceAdvances[] = [
  { face: "liberation-sans-regular", advances: sansRegular.advances },
  { face: "liberation-sans-bold", advances: sansBold.advances },
  { face: "liberation-sans-italic", advances: sansItalic.advances },
  { face: "liberation-sans-bold-italic", advances: sansBoldItalic.advances },
  { face: "liberation-serif-regular", advances: serifRegular.advances },
  { face: "liberation-serif-bold", advances: serifBold.advances },
  { face: "liberation-serif-italic", advances: serifItalic.advances },
  { face: "liberation-serif-bold-italic", advances: serifBoldItalic.advances },
  { face: "liberation-mono-regular", advances: monoRegular.advances },
  { face: "liberation-mono-bold", advances: monoBold.advances },
  { face: "liberation-mono-italic", advances: monoItalic.advances },
  { face: "liberation-mono-bold-italic", advances: monoBoldItalic.advances },
  { face: "carlito-regular", advances: carlitoRegular.advances },
]

const listShape = (list: "bullet" | "numbered", level: number): BlockShape =>
  ({ kind: "text", list, level }) as unknown as BlockShape

const bulletMarkers: string[] = [0, 1, 2, 3, 4, 5].map(
  (level) => nextCounters([], listShape("bullet", level)).marker as string
)

const numberedMarkers = [0, 1, 2].flatMap((level) =>
  Array.from({ length: 1000 }, (_, n) => numberLabel(n + 1, level))
)

const markers = new Set([...bulletMarkers, ...numberedMarkers])

function missingMarkerAdvances(
  face: string,
  advances: Record<string, number>
): string[] {
  const problems: string[] = []
  for (const marker of markers)
    for (const char of marker) {
      const codePoint = char.codePointAt(0)
      if (codePoint === undefined) continue
      if (!(String(codePoint) in advances))
        problems.push(
          `${face} has no advance for U+${codePoint.toString(16)} in marker ${JSON.stringify(marker)}`
        )
    }
  return problems
}

const numberedGlyphAdvances = (): Record<string, number> => {
  const advances: Record<string, number> = {}
  for (const marker of numberedMarkers)
    for (const char of marker) {
      const codePoint = char.codePointAt(0)
      if (codePoint !== undefined) advances[String(codePoint)] = 556
    }
  return advances
}

describe("every marker glyph the layout can emit has metrics in every face", () => {
  it("the bullet markers cycle the three list glyphs and repeat after level 3", () => {
    expect(bulletMarkers).toEqual([
      "\u2022",
      "\u25e6",
      "\u25aa",
      "\u2022",
      "\u25e6",
      "\u25aa",
    ])
  })

  it("the numbered markers cover the digits, every letter and every roman glyph", () => {
    expect(numberedMarkers).toContain("1.")
    expect(numberedMarkers).toContain("10.")
    expect(numberedMarkers).toContain("z.")
    expect(numberedMarkers).toContain("m.")
  })

  it("the mistake fixture fires: a face without the bullet and digit advances is named", () => {
    const advances = numberedGlyphAdvances()
    expect(missingMarkerAdvances("mistake-regular", advances)).toEqual([
      'mistake-regular has no advance for U+2022 in marker "\u2022"',
      'mistake-regular has no advance for U+25e6 in marker "\u25e6"',
      'mistake-regular has no advance for U+25aa in marker "\u25aa"',
    ])
    const withoutDigitFive = numberedGlyphAdvances()
    delete withoutDigitFive[String("5".charCodeAt(0))]
    expect(
      missingMarkerAdvances("mistake-regular", withoutDigitFive)
    ).toContain('mistake-regular has no advance for U+35 in marker "5."')
  })

  it("the clean fixture stays quiet: a face with every marker advance reports nothing", () => {
    const advances = numberedGlyphAdvances()
    for (const marker of bulletMarkers)
      for (const char of marker) {
        const codePoint = char.codePointAt(0)
        if (codePoint !== undefined) advances[String(codePoint)] = 556
      }
    expect(missingMarkerAdvances("clean-regular", advances)).toEqual([])
  })

  it("every stored face measures every marker glyph the layout can emit", () => {
    for (const face of faces) {
      const problems = missingMarkerAdvances(face.face, face.advances)
      expect(problems).toEqual([])
    }
  })
})
