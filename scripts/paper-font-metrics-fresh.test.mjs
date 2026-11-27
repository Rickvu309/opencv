import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { openSync as openFont } from "fontkit"
import {
  CORPUS_DIRECTORY,
  FONTS_DIRECTORY,
  MANIFEST_FILE,
  METRICS_DIRECTORY,
  corpusTexts,
  detectStaleFaces,
  faceMetrics,
  faceMetricsJson,
  kerningFeatures,
  listGlyphCodePoints,
  neededCodePoints,
  sha256Hex,
  TAB_CODE_POINT,
  vietnameseCodePoints,
} from "./lib/paper-font-metrics.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const fontsDir = join(root, FONTS_DIRECTORY)
const metricsDir = join(root, METRICS_DIRECTORY)

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(
        `./fixtures/paper-font-metrics-fresh/${name}.json`,
        import.meta.url
      ),
      "utf8"
    )
  )

const serialized = (input) =>
  Object.fromEntries(
    Object.entries(input).map(([face, metrics]) => [
      face,
      metrics === undefined ? undefined : faceMetricsJson(metrics),
    ])
  )

test("the mistake fixture fires: a font changed and its metrics were not regenerated", () => {
  const mistake = fixture("mistake")
  assert.deepEqual(
    detectStaleFaces({
      faces: mistake.faces,
      fontSha256s: mistake.fontSha256s,
      storedMetrics: serialized(mistake.storedMetrics),
      computedMetrics: serialized(mistake.computedMetrics),
    }),
    [
      `${METRICS_DIRECTORY}/alpha-regular.json is stale or missing: run node scripts/paper-font-metrics.mjs`,
      `${MANIFEST_FILE} sha256 is stale for Beta-Regular.ttf: run node scripts/paper-font-metrics.mjs`,
      `${METRICS_DIRECTORY}/beta-regular.json is stale or missing: run node scripts/paper-font-metrics.mjs`,
    ]
  )
})

test("the clean fixture stays quiet: every sha256 and metrics file is fresh", () => {
  const clean = fixture("clean")
  assert.deepEqual(
    detectStaleFaces({
      faces: clean.faces,
      fontSha256s: clean.fontSha256s,
      storedMetrics: serialized(clean.storedMetrics),
      computedMetrics: serialized(clean.computedMetrics),
    }),
    []
  )
})

test("a metrics file for a face fonts.json does not list is stale too", () => {
  const clean = fixture("clean")
  const computedMetrics = serialized(clean.computedMetrics)
  computedMetrics["ghost-regular"] = computedMetrics["alpha-regular"]
  assert.deepEqual(
    detectStaleFaces({
      faces: clean.faces,
      fontSha256s: clean.fontSha256s,
      storedMetrics: serialized(clean.storedMetrics),
      computedMetrics,
    }),
    [
      `${METRICS_DIRECTORY}/ghost-regular.json is not a face in ${MANIFEST_FILE}: remove it or list its face`,
    ]
  )
})

const manifest = JSON.parse(readFileSync(join(root, MANIFEST_FILE), "utf8"))
const codePoints = neededCodePoints(corpusTexts(root))

const computedMetrics = {}
const storedMetrics = {}
const fontSha256s = {}
for (const face of manifest.faces) {
  const file = join(fontsDir, face.file)
  const sha256 = sha256Hex(readFileSync(file))
  fontSha256s[face.file] = sha256
  computedMetrics[face.face] = faceMetricsJson(
    faceMetrics({
      face: face.face,
      file: face.file,
      sha256,
      font: openFont(file),
      codePoints,
    })
  )
}
for (const name of readdirSync(metricsDir)) {
  storedMetrics[name.replace(/\.json$/u, "")] = readFileSync(
    join(metricsDir, name),
    "utf8"
  )
}

test("the fonts in apps/web/public/fonts and the metrics in the pack are fresh", () => {
  assert.deepEqual(
    detectStaleFaces({
      faces: manifest.faces,
      fontSha256s,
      storedMetrics,
      computedMetrics,
    }),
    []
  )
})

test("stored metrics equal the parser's own advances and kerning for every face", () => {
  for (const face of manifest.faces) {
    const stored = JSON.parse(storedMetrics[face.face])
    const font = openFont(join(fontsDir, face.file))
    const millipoints = 1000 / font.unitsPerEm
    assert.equal(stored.unitsPerEm, font.unitsPerEm)
    assert.equal(stored.ascent, Math.round(font.ascent * millipoints))
    assert.equal(stored.descent, Math.round(font.descent * millipoints))
    assert.equal(stored.lineGap, Math.round(font.lineGap * millipoints))
    for (const codePoint of codePoints) {
      assert.equal(
        stored.advances[String(codePoint)],
        Math.round(
          font.glyphForCodePoint(codePoint).advanceWidth * millipoints
        ),
        `${face.face} advance for U+${codePoint.toString(16)}`
      )
    }
    for (const [left, rightPairs] of Object.entries(stored.kerning)) {
      for (const [right, pair] of Object.entries(rightPairs)) {
        const run = font.layout(
          String.fromCodePoint(Number(left), Number(right)),
          kerningFeatures
        )
        assert.equal(
          pair,
          Math.round(
            (run.positions[0].xAdvance -
              font.glyphForCodePoint(Number(left)).advanceWidth) *
              millipoints
          ),
          `${face.face} kerning for U+${left} U+${right}`
        )
      }
    }
  }
})

test("fonts.json lists the four families kept at gate G0 with Cambria mapped over Caladea", () => {
  assert.deepEqual(
    manifest.faces.map((face) => face.face),
    [
      "liberation-sans-regular",
      "liberation-sans-bold",
      "liberation-sans-italic",
      "liberation-sans-bold-italic",
      "liberation-serif-regular",
      "liberation-serif-bold",
      "liberation-serif-italic",
      "liberation-serif-bold-italic",
      "liberation-mono-regular",
      "liberation-mono-bold",
      "liberation-mono-italic",
      "liberation-mono-bold-italic",
      "carlito-regular",
    ]
  )
  const wordNames = {
    "liberation-sans": "Arial",
    "liberation-serif": "Times New Roman",
    "liberation-mono": "Courier New",
    carlito: "Calibri",
  }
  for (const face of manifest.faces) {
    assert.equal(face.wordName, wordNames[face.family])
    assert.match(face.sha256, /^[0-9a-f]{64}$/u)
    assert.ok(face.weight === 400 || face.weight === 700)
    assert.ok(face.style === "normal" || face.style === "italic")
    assert.ok(existsSync(join(fontsDir, face.file)))
    assert.ok(!face.file.includes("Caladea"))
  }
  assert.deepEqual(manifest.wordImports, [
    { wordName: "Cambria", family: "liberation-serif" },
  ])
})

test("the needed code points include the list marker glyphs and the fallback glyph the layout emits", () => {
  const needed = neededCodePoints(corpusTexts(root))
  for (const codePoint of listGlyphCodePoints())
    assert.ok(
      needed.includes(codePoint),
      `U+${codePoint.toString(16)} is missing from the needed set`
    )
})

test("a corpus Vietnamese sentence has every code point in every face", () => {
  const corpus = JSON.parse(
    readFileSync(join(root, CORPUS_DIRECTORY, "vi-01.expected.json"), "utf8")
  )
  const sentence = corpus.blocks
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join(" ")
  assert.ok(sentence.length > 0)
  for (const face of manifest.faces) {
    const stored = JSON.parse(storedMetrics[face.face])
    for (const char of sentence) {
      const codePoint = char.codePointAt(0)
      if (codePoint === TAB_CODE_POINT) continue
      assert.ok(
        codePoint in stored.advances,
        `${face.face} is missing U+${codePoint.toString(16)}`
      )
    }
    for (const codePoint of vietnameseCodePoints())
      assert.ok(
        codePoint in stored.advances,
        `${face.face} is missing Vietnamese U+${codePoint.toString(16)}`
      )
  }
})
