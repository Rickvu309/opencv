import assert from "node:assert/strict"
import test from "node:test"

import { validateSpec } from "../annotate.mjs"
import { HIG_CALLOUTS, higFound, higLine, higSpec } from "./hig.mjs"

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

test("a finding spec is a valid single-image annotate spec with numbered arrows, the rest as text", () => {
  const findings = [
    ...Array.from({ length: 12 }, (_, at) => finding(at)),
    finding(99, { x: 10, y: 2000, width: 40, height: 16 }),
    finding(100, null),
  ]
  const spec = higSpec(item(findings))
  assert.deepEqual(validateSpec(spec), [])
  const [section] = spec.sections
  assert.equal(section.image, "/shots/settings-390x844-hig.png")
  assert.equal(section.callouts.length, HIG_CALLOUTS)
  assert.deepEqual(
    section.callouts.map((callout) => callout.n),
    Array.from({ length: HIG_CALLOUTS }, (_, at) => at + 1)
  )
  assert.equal(section.also.length, 4)
  assert.match(section.also.at(-1), /^"Item 100": /)
  assert.match(section.title, /Accessibility \(https:\/\/developer\.apple\.com/)
})

test("a guideline line names the screen, size, rule, source, measure, screenshot, annotate command and repro", () => {
  const line = higLine(
    item([finding(0)]),
    "/state/sweep/hig/settings-390x844-hig-contrast.spec.json"
  )
  assert.equal(
    line,
    "HIG settings at 390x844: hig-contrast (Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility): 1 findings · screenshot /shots/settings-390x844-hig.png · annotate: node scripts/ui.mjs annotate --spec /state/sweep/hig/settings-390x844-hig-contrast.spec.json --out /state/sweep/hig/settings-390x844-hig-contrast.png · repro: node scripts/ui.mjs sweep screen settings --size 390x844"
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
