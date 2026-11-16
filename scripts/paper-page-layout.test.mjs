import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  detectPageLayout,
  pageBandHits,
  repeatingGapBands,
} from "./lib/paper-page-layout.mjs"

const root = new URL("../", import.meta.url)
const css = "apps/web/src/features/paper/rich-page-geometry.css"
const layout = "packages/paper-crdt/src/rich-page-layout.ts"
const setup = "apps/web/src/features/paper/rich-page-setup.tsx"

test("a continuous sheet has no gap bands for text to cross", () => {
  const line = { top: 1060, bottom: 1076 }
  const content = { top: 96, bottom: 2100 }
  const painted = repeatingGapBands(true, 1056, 24, 2200)
  assert.deepEqual(
    painted.map((band) => [band.top, band.bottom]),
    [
      [1056, 1080],
      [2136, 2160],
    ]
  )
  assert.equal(pageBandHits([line], painted, content).gapHits.length, 1)
  assert.deepEqual(repeatingGapBands(false, 1056, 24, 2200), [])
  assert.deepEqual(pageBandHits([line], [], content), {
    gapHits: [],
    marginHits: [],
  })
  assert.equal(
    pageBandHits([{ top: 2088, bottom: 2112 }], [], content).marginHits.length,
    1
  )
})

test("page geometry refuses gap paint and page height outside supported pagination", () => {
  for (const declaration of [
    "background: repeating-linear-gradient(to bottom, white, gray)",
    "min-block-size: var(--cv-rich-page-height)",
  ]) {
    for (const selector of [
      ".paper-rich-sheet",
      '.paper-rich-sheet[data-paper-pagination="false"]',
      '.paper-rich-sheet[data-paper-pagination="true"]',
      '.paper-rich-sheet[data-paper-pagination="true"][data-paper-reflow="false"], .paper-rich-sheet',
    ])
      assert.ok(detectPageLayout(`${selector} { ${declaration}; }`, css).length)
    assert.deepEqual(
      detectPageLayout(
        `.paper-rich-sheet[data-paper-pagination="true"][data-paper-reflow="false"] { ${declaration}; }`,
        css
      ),
      []
    )
  }
})

test("page scaling is refused structurally across viewport and measured-width variants", () => {
  for (const value of [
    "String(scale)",
    "String(phone ? 1 : Math.min(1, available / width))",
    '"0.8"',
  ])
    assert.ok(
      detectPageLayout(
        `host.style.setProperty("--cv-rich-page-scale", ${value})`,
        layout
      ).length
    )
  assert.deepEqual(
    detectPageLayout(
      'host.style.setProperty("--cv-rich-page-scale", "1")',
      layout
    ),
    []
  )
  assert.ok(
    detectPageLayout(".paper-rich-sheet { zoom: var(--scale); }", css).length
  )
  assert.deepEqual(
    detectPageLayout(
      ".paper-rich-sheet { zoom: 1; background: var(--card); }",
      css
    ),
    []
  )
})

const reviewedGapSheet = `.paper-rich-sheet {
  min-block-size: var(--cv-rich-page-height, 1056px);
  zoom: var(--cv-rich-page-scale, 1);
  background: repeating-linear-gradient(
    to bottom,
    var(--card) 0 var(--cv-rich-page-height, 1056px),
    var(--muted) var(--cv-rich-page-height, 1056px)
      var(--cv-rich-page-pitch, 1080px)
  );
}

@media (max-width: 639px) {
  .paper-rich-sheet [data-paper-layout="paperFlowSection"] > [data-paper-wrap-slot] {
    column-height: auto !important;
    column-wrap: nowrap !important;
  }
}
`

const reviewedScale =
  'element.style.setProperty("--cv-rich-page-scale", String(scale))'

test("the reviewed page sheet fails both guards and repaired sources pass", () => {
  assert.ok(detectPageLayout(reviewedGapSheet, css).length)
  assert.ok(detectPageLayout(reviewedScale, layout).length)
  for (const file of [css, layout])
    assert.deepEqual(
      detectPageLayout(readFileSync(new URL(file, root), "utf8"), file),
      [],
      file
    )
})

test("page setup preserves fractional margins and physical phone targets", () => {
  const clean = readFileSync(new URL(setup, root), "utf8")
  assert.deepEqual(detectPageLayout(clean, setup), [])
  for (const [before, after] of [
    ['step="any"', 'step="0.01"'],
    ["min-h-[44px]", "min-h-11"],
  ]) {
    assert.notEqual(clean.replaceAll(before, after), clean)
    assert.ok(detectPageLayout(clean.replaceAll(before, after), setup).length)
  }
  const reviewedSetup = `<Input type="number" step="0.01" />
<Button className="min-h-11 md:min-h-8">Cancel</Button>`
  const hits = detectPageLayout(reviewedSetup, setup)
  assert.ok(hits.some((hit) => hit.includes("fractional")))
  assert.ok(hits.some((hit) => hit.includes("44px")))
})
