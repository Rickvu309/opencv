import assert from "node:assert/strict"
import { test } from "node:test"

import { coveredTextProbe, judgeCoveredText } from "./covered-text.mjs"

const clean = { surfaces: 1, texts: 17, clipped: 0, covered: [] }

test("a picture with every text uncovered passes", () => {
  assert.deepEqual(judgeCoveredText({ tag: "t", result: clean }), [])
})

test("a covered text is named with the card on top of it", () => {
  const lines = judgeCoveredText({
    tag: "1440 /pitch",
    result: {
      ...clean,
      covered: [{ text: "52% open rate", by: 'div "24views"', x: 1, y: 2 }],
    },
  })
  assert.equal(lines.length, 1)
  assert.match(lines[0], /"52% open rate" is covered by div "24views"/)
})

test("a page with no marked picture fails instead of passing empty", () => {
  const lines = judgeCoveredText({
    tag: "t",
    result: { surfaces: 0, texts: 0, clipped: 0, covered: [] },
  })
  assert.match(lines[0], /no \[data-illustration\] surface/)
})

test("a picture whose texts are all clipped proves nothing", () => {
  const lines = judgeCoveredText({
    tag: "t",
    result: { surfaces: 1, texts: 9, clipped: 8, covered: [] },
  })
  assert.match(lines[0], /proved nothing/)
})

test("the probe is one expression for the page", () => {
  assert.match(coveredTextProbe(), /elementFromPoint/)
})
