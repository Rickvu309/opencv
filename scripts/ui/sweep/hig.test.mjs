import assert from "node:assert/strict"
import test from "node:test"

import { higFound, higLine } from "./hig.mjs"

const finding = (at, rect = { x: 10, y: 20 + at, width: 40, height: 16 }) => ({
  rule: "hig-contrast",
  name: `"Item ${at}"`,
  measured: "14px/400 text #969696 on #ffffff is 2.96:1, needs 4.5:1",
  rect,
})

const item = (findings) => ({
  screen: "settings",
  size: "390x844",
  ok: true,
  advisory: true,
  rule: "hig-contrast",
  source: {
    page: "Accessibility",
    url: "https://developer.apple.com/design/human-interface-guidelines/accessibility",
    quote: "Strive to meet color contrast minimum standards.",
  },
  findings,
  problem: `${findings.length} findings`,
  shot: "/shots/settings-390x844-hig.png",
  repro: "node scripts/ui.mjs sweep screen settings --size 390x844",
})

test("a guideline line names the screen, size, rule, source, measure, screenshot and repro", () => {
  const line = higLine(item([finding(0)]))
  assert.equal(
    line,
    "HIG settings at 390x844: hig-contrast (Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility): 1 findings, screenshot /shots/settings-390x844-hig.png, repro: node scripts/ui.mjs sweep screen settings --size 390x844"
  )
})

test("only guideline cases with findings are listed", () => {
  assert.deepEqual(
    higFound([
      item([]),
      item([finding(0)]),
      { rule: "fits", ok: false, findings: [finding(1)] },
    ]).map((found) => found.findings.length),
    [1]
  )
})

test("a case without a screenshot names none", () => {
  assert.doesNotMatch(
    higLine({ ...item([finding(0)]), shot: undefined }),
    /screenshot/
  )
})
