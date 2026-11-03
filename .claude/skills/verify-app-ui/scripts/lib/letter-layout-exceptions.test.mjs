import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  bodyGapMismatches,
  PEN_LAYOUT_EXCEPTIONS,
  SIGN_OFF_GAP_DEVIATION,
} from "./letter-layout-exceptions.mjs"

const layout = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../apps/web/src/features/paper/design/letter-editor.layout.json",
      import.meta.url
    ),
    "utf8"
  )
)

const measuredWith = (signatureGap) => {
  const measured = layout.texts.map((t) => ({ y: t.y }))
  measured[15] = { y: 500.5 }
  measured[16] = { y: 500.5 + signatureGap }
  return measured
}

test("the recorded sign-off gap passes", () => {
  assert.deepEqual(
    bodyGapMismatches(
      layout.texts,
      measuredWith(SIGN_OFF_GAP_DEVIATION.appGap),
      "2026-11-03"
    ),
    []
  )
})

test("a sign-off gap that now matches the frame makes the deviation stale", () => {
  const found = bodyGapMismatches(layout.texts, measuredWith(17), "2026-11-03")
  assert.match(found[0].text, /deviation stale/)
})

test("a sign-off gap that moves away from the record is reported", () => {
  const found = bodyGapMismatches(layout.texts, measuredWith(40), "2026-11-03")
  assert.match(found[0].text, /deviation drifted/)
})

test("an expired sign-off deviation is reported", () => {
  const found = bodyGapMismatches(
    layout.texts,
    measuredWith(SIGN_OFF_GAP_DEVIATION.appGap),
    "2027-01-01"
  )
  assert.match(found[0].text, /deviation expired/)
})

test("the sender exceptions name the sender line and not the signature", () => {
  const sender = PEN_LAYOUT_EXCEPTIONS.filter(
    (entry) => entry.text === "Linh Nguyen"
  )
  assert.ok(sender.length > 0)
  for (const entry of sender) assert.equal(entry.index, 4)
  assert.equal(layout.texts[4].text, "Linh Nguyen")
  assert.equal(layout.texts[SIGN_OFF_GAP_DEVIATION.index].text, "Linh Nguyen")
})
