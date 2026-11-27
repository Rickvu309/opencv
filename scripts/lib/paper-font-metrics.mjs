import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const FONTS_DIRECTORY = "apps/web/public/fonts"
export const MANIFEST_FILE = "packages/paper-fonts/fonts.json"
export const METRICS_DIRECTORY = "packages/paper-fonts/metrics"
export const CORPUS_DIRECTORY = "packages/paper-corpus/tests/fixtures/cvs"

export const kerningFeatures = {
  kern: true,
  liga: false,
  rlig: false,
  calt: false,
  clig: false,
}

const latinRanges = [
  [0x0041, 0x005a],
  [0x0061, 0x007a],
]

const vietnameseRanges = [
  [0x00c0, 0x00c3],
  [0x00c8, 0x00ca],
  [0x00cc, 0x00cd],
  [0x00d2, 0x00d5],
  [0x00d9, 0x00da],
  [0x00dd, 0x00dd],
  [0x00e0, 0x00e3],
  [0x00e8, 0x00ea],
  [0x00ec, 0x00ed],
  [0x00f2, 0x00f5],
  [0x00f9, 0x00fa],
  [0x00fd, 0x00fd],
  [0x0102, 0x0103],
  [0x0110, 0x0111],
  [0x0128, 0x0129],
  [0x0168, 0x0169],
  [0x01a0, 0x01a1],
  [0x01af, 0x01b0],
  [0x1ea0, 0x1ef9],
]

function rangeCodePoints([start, end]) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

export function vietnameseCodePoints() {
  return [...new Set(vietnameseRanges.flatMap(rangeCodePoints))].sort(
    (a, b) => a - b
  )
}

export function corpusTexts(root) {
  return readdirSync(join(root, CORPUS_DIRECTORY))
    .filter((name) => name.endsWith(".expected.json"))
    .flatMap((name) => {
      const doc = JSON.parse(
        readFileSync(join(root, CORPUS_DIRECTORY, name), "utf8")
      )
      return doc.blocks.flatMap((block) => {
        const parts = []
        if (typeof block.text === "string") parts.push(block.text)
        if (typeof block.alt === "string") parts.push(block.alt)
        for (const row of block.rows || [])
          for (const cell of row) parts.push(String(cell))
        return parts
      })
    })
}

const tabCodePoint = 0x0009

const listBulletCodePoints = [0x2022, 0x25e6, 0x25aa]
const listNumberCodePoints = [
  ...rangeCodePoints([0x0030, 0x0039]),
  ...rangeCodePoints([0x0061, 0x007a]),
  0x002e,
]
const fallbackGlyphCodePoint = 0x003f

export function listGlyphCodePoints() {
  return [
    ...new Set([
      ...listBulletCodePoints,
      ...listNumberCodePoints,
      fallbackGlyphCodePoint,
    ]),
  ].sort((a, b) => a - b)
}

export function neededCodePoints(texts) {
  const needed = new Set([
    0x0020,
    ...vietnameseCodePoints(),
    ...listGlyphCodePoints(),
  ])
  for (const text of texts)
    for (const char of text) needed.add(char.codePointAt(0))
  needed.delete(tabCodePoint)
  return [...needed].sort((a, b) => a - b)
}

export function detectMissingListGlyphs(metricsJson, file) {
  const metrics = JSON.parse(metricsJson)
  return listGlyphCodePoints()
    .filter((codePoint) => !(String(codePoint) in metrics.advances))
    .map(
      (codePoint) =>
        `${file} has no advance for U+${codePoint.toString(16)}: run node scripts/paper-font-metrics.mjs`
    )
}

export const TAB_CODE_POINT = tabCodePoint

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function hexCodePoints(codePoints) {
  return codePoints.map((codePoint) => `U+${codePoint.toString(16)}`).join(" ")
}

export function kerningMillipoints(font, left, right) {
  const run = font.layout(String.fromCodePoint(left, right), kerningFeatures)
  if (run.positions.length < 1) return 0
  const raw = font.glyphForCodePoint(left).advanceWidth
  return run.positions[0].xAdvance - raw
}

export function faceMetrics({ face, file, sha256, font, codePoints }) {
  const millipoints = 1000 / font.unitsPerEm
  const advances = {}
  const missing = []
  for (const codePoint of codePoints) {
    if (!font.hasGlyphForCodePoint(codePoint)) {
      missing.push(codePoint)
      continue
    }
    advances[String(codePoint)] = Math.round(
      font.glyphForCodePoint(codePoint).advanceWidth * millipoints
    )
  }
  if (missing.length)
    throw new Error(`${file} has no glyph for ${hexCodePoints(missing)}`)
  const kerning = {}
  for (const left of codePoints) {
    const rightPairs = {}
    for (const right of codePoints) {
      const pair = Math.round(
        kerningMillipoints(font, left, right) * millipoints
      )
      if (pair !== 0) rightPairs[String(right)] = pair
    }
    if (Object.keys(rightPairs).length > 0) kerning[String(left)] = rightPairs
  }
  return {
    face,
    file,
    sha256,
    unitsPerEm: font.unitsPerEm,
    ascent: Math.round(font.ascent * millipoints),
    descent: Math.round(font.descent * millipoints),
    lineGap: Math.round(font.lineGap * millipoints),
    advances,
    kerning,
  }
}

export function faceMetricsJson(metrics) {
  return `${JSON.stringify(metrics, null, 2)}\n`
}

export function detectStaleFaces({
  faces,
  fontSha256s,
  storedMetrics,
  computedMetrics,
}) {
  const problems = []
  for (const face of faces) {
    if (face.sha256 !== fontSha256s[face.file])
      problems.push(
        `${MANIFEST_FILE} sha256 is stale for ${face.file}: run node scripts/paper-font-metrics.mjs`
      )
    if (storedMetrics[face.face] !== computedMetrics[face.face])
      problems.push(
        `${METRICS_DIRECTORY}/${face.face}.json is stale or missing: run node scripts/paper-font-metrics.mjs`
      )
  }
  const listed = new Set(faces.map((face) => face.face))
  for (const face of new Set([
    ...Object.keys(storedMetrics),
    ...Object.keys(computedMetrics),
  ])) {
    if (listed.has(face)) continue
    problems.push(
      `${METRICS_DIRECTORY}/${face}.json is not a face in ${MANIFEST_FILE}: remove it or list its face`
    )
  }
  return problems
}
