import assert from "node:assert/strict"
import test from "node:test"
import { validateSpec } from "./annotate.mjs"
import { CHECK_ARROWS, failureGroups, failureSpec } from "./check-annotate.mjs"

const rows = [
  { label: "Sidebar", frame: "aBc12", props: ["width"] },
  { label: "Card", frame: "kP9", props: ["radius", "height"] },
  { label: "Footer", frame: "zz1", props: ["y"] },
  { label: "Tab", against: "paper-home", props: ["x"] },
]
const rendered = [
  { x: 0, y: 0, width: 240, height: 900 },
  { x: 300, y: 120, width: 560, height: 180 },
  { x: 0, y: 1200, width: 1440, height: 64 },
  { x: 40, y: 12, width: 80, height: 28 },
]
const failure = (element, property, design, measured, onMain = null) => ({
  element,
  property,
  design,
  rendered: measured,
  difference: measured - design,
  status: "mismatch",
  onMain,
})

test("each failing element gets one numbered arrow with expected, measured and its pen frame, new failures first", () => {
  const result = {
    screen: "paper-home",
    failures: [
      failure("Sidebar", "width", 220, 240, { rendered: 240, changed: false }),
      failure("Card", "radius", 8, 12),
      failure("Card", "height", 176, 180),
      failure("Footer", "y", 1180, 1200),
      failure("Tab vs paper-home", "x", 36, 40),
    ],
  }
  const spec = failureSpec({
    screen: "paper-home",
    rows,
    rendered,
    result,
    image: "paper-home-check.screen.png",
  })
  assert.deepEqual(validateSpec(spec), [])
  const [section] = spec.sections
  assert.equal(
    section.title,
    "paper-home at 1440: 4 failing elements against the design"
  )
  assert.deepEqual(
    section.callouts.map((callout) => callout.note),
    [
      "Card: radius expected 8px, measured 12px; height expected 176px, measured 180px, source pen frame kP9",
      "Tab vs paper-home: x expected 36px, measured 40px, source screen paper-home",
      "Sidebar: width expected 220px, measured 240px, source pen frame aBc12 (already failing on main)",
    ]
  )
  assert.deepEqual(section.callouts[0].target, rendered[1])
  assert.deepEqual(section.also, [
    "Footer: y expected 1180px, measured 1200px, source pen frame zz1 (not on the first screen)",
  ])
})

test("past the arrow cap the remaining failures are legend text, and a missing element says so", () => {
  const many = Array.from({ length: CHECK_ARROWS + 2 }, (_, at) => ({
    label: `Row ${at}`,
    frame: `f${at}`,
    props: ["height"],
  }))
  const boxes = many.map((_, at) => ({
    x: 10,
    y: 10 + at * 50,
    width: 100,
    height: 30,
  }))
  const result = {
    failures: [
      ...many.map((row) => failure(row.label, "height", 32, 30)),
      { ...failure("Gone", "width", 10, 0), rendered: null, status: "missing" },
    ],
  }
  const [section] = failureSpec({
    screen: "s",
    rows: [...many, { label: "Gone", frame: "g1", props: ["width"] }],
    rendered: [...boxes, null],
    result,
    image: "s.png",
  }).sections
  assert.equal(section.callouts.length, CHECK_ARROWS)
  assert.equal(section.also.length, 3)
  assert.match(
    section.also.at(-1),
    /^Gone: width expected 10px, measured missing, source pen frame g1/
  )
  assert.deepEqual(failureGroups({ rows: [], rendered: [], result: {} }), [])
})
