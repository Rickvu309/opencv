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

import type { FaceKey, FontFace, Metrics } from "./types.js"

export type FaceTable = {
  face: string
  ascent: number
  descent: number
  lineGap: number
  advances: Readonly<Record<string, number>>
}

const FAMILY_SLUGS: Readonly<Record<string, string>> = {
  "Liberation Sans": "liberation-sans",
  "Liberation Serif": "liberation-serif",
  "Liberation Mono": "liberation-mono",
  Carlito: "carlito",
}

const SINGLE_FACE_FAMILIES = new Set(["carlito"])

export function faceKey(
  family: string,
  bold: boolean,
  italic: boolean
): FaceKey {
  const slug = FAMILY_SLUGS[family] ?? "liberation-sans"
  if (SINGLE_FACE_FAMILIES.has(slug)) return `${slug}-regular`
  const variant =
    bold && italic
      ? "bold-italic"
      : bold
        ? "bold"
        : italic
          ? "italic"
          : "regular"
  return `${slug}-${variant}`
}

const COMBINING = /\p{M}/u
const isCombining = (codePoint: number) =>
  COMBINING.test(String.fromCodePoint(codePoint))

function faceFromTable(table: FaceTable): FontFace {
  const advances = new Map<number, number>()
  for (const [code, advance] of Object.entries(table.advances)) {
    advances.set(Number(code), advance)
  }
  const missing = advances.get(48) ?? 500
  const cache = new Map<number, number>()
  return {
    ascent: table.ascent,
    descent: table.descent,
    lineGap: table.lineGap,
    advance(codePoint) {
      const known = advances.get(codePoint)
      if (known !== undefined) return known
      let guessed = cache.get(codePoint)
      if (guessed === undefined) {
        guessed = isCombining(codePoint) ? 0 : missing
        cache.set(codePoint, guessed)
      }
      return guessed
    },
  }
}

export function tableMetrics(tables: readonly FaceTable[]): Metrics {
  const faces = new Map(
    tables.map((table) => [table.face, faceFromTable(table)])
  )
  const fallback =
    faces.get("liberation-sans-regular") ?? faces.values().next().value
  if (!fallback) throw new Error("tableMetrics needs at least one face")
  return { face: (key) => faces.get(key) ?? fallback }
}

export function fixedMetrics(advance = 500): Metrics {
  const face: FontFace = {
    ascent: 800,
    descent: -200,
    lineGap: 0,
    advance: () => advance,
  }
  return { face: () => face }
}

export const paperFontMetrics: Metrics = tableMetrics([
  sansRegular,
  sansBold,
  sansItalic,
  sansBoldItalic,
  serifRegular,
  serifBold,
  serifItalic,
  serifBoldItalic,
  monoRegular,
  monoBold,
  monoItalic,
  monoBoldItalic,
  carlitoRegular,
])
