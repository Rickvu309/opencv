import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  colorDistance,
  colorMatches,
  comparePenLayout,
  formatMismatch,
  PEN_LAYOUT_EXCEPTIONS,
} from "./pen-layout-compare.mjs"

const here = new URL(".", import.meta.url)
const readJson = (path) => JSON.parse(readFileSync(new URL(path, here), "utf8"))

const text = (over = {}) => ({
  text: "One link that sells you",
  x: 65,
  y: 338,
  width: 370,
  height: 141,
  fontSize: 64,
  fontWeight: 600,
  letterSpacing: -3,
  lineHeight: 77,
  color: "rgba(17, 17, 17, 1)",
  textAlign: "left",
  ...over,
})
const layout = (texts) => ({ frameId: "TEST1", route: "/test", texts })
const run = (want, got, exceptions = []) =>
  comparePenLayout({
    layout: layout([want]),
    measured: [got],
    exceptions,
    today: "2026-10-28",
  })
const properties = (result) => result.mismatches.map((m) => m.property)

test("a matching measurement passes", () => {
  assert.deepEqual(run(text(), text()).mismatches, [])
})

test("small drift inside the tolerances passes", () => {
  const got = text({
    x: 72,
    y: 345,
    fontSize: 64.4,
    letterSpacing: -2.8,
    color: "rgba(20, 20, 20, 1)",
  })
  assert.deepEqual(run(text(), got).mismatches, [])
})

test("a shifted text fails on its position", () => {
  assert.deepEqual(properties(run(text(), text({ x: 330, y: 160 }))), [
    "x",
    "y",
  ])
})

test("centre and right aligned text compare their own anchor", () => {
  const want = text({ textAlign: "center", x: 100, width: 200 })
  assert.deepEqual(run(want, text({ x: 50, width: 300 })).mismatches, [])
  const right = text({ textAlign: "right", x: 100, width: 200 })
  assert.deepEqual(properties(run(right, text({ x: 100, width: 100 }))), ["x"])
})

test("a wrong size, weight, spacing or colour fails", () => {
  const got = text({
    fontSize: 30,
    fontWeight: 500,
    letterSpacing: 0,
    color: "rgba(89, 89, 91, 1)",
  })
  assert.deepEqual(properties(run(text(), got)), [
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "color",
  ])
})

test("a missing text fails", () => {
  const result = run(text(), null)
  assert.deepEqual(result.mismatches, [
    { text: text().text, property: "text", pen: "present", app: "missing" },
  ])
  assert.equal(
    formatMismatch(layout([]), result.mismatches[0]),
    'FAIL TEST1 /test "One link that sells you" text: pen present app missing'
  )
})

test("colour distance is zero for the same colour and grows with the gap", () => {
  assert.equal(colorDistance("rgba(17, 17, 17, 1)", "rgba(17, 17, 17, 1)"), 0)
  assert.ok(
    colorDistance("rgba(17, 17, 17, 1)", "rgba(255, 255, 255, 1)") > 0.5
  )
})

const exception = (over = {}) => ({
  frameId: "TEST1",
  text: text().text,
  property: "fontSize",
  reason: "pen value fails a contrast rule",
  until: "2026-12-31",
  approvedBy: "operator",
  ...over,
})

test("an exception hides the mismatch it names while it is live", () => {
  assert.deepEqual(
    run(text(), text({ fontSize: 30 }), [exception()]).mismatches,
    []
  )
})

test("an expired exception fails", () => {
  const result = run(text(), text({ fontSize: 30 }), [
    exception({ until: "2026-01-01" }),
  ])
  assert.deepEqual(properties(result), ["exception", "fontSize"])
})

test("a stale exception fails because the property now matches", () => {
  const result = run(text(), text(), [exception()])
  assert.deepEqual(properties(result), ["exception"])
  assert.match(result.mismatches[0].app, /stale/)
})

test("an exception for another frame does not apply", () => {
  const result = run(text(), text({ fontSize: 30 }), [
    exception({ frameId: "OTHER" }),
  ])
  assert.deepEqual(properties(result), ["fontSize"])
})

test("the shipped exception list starts empty", () => {
  assert.deepEqual(PEN_LAYOUT_EXCEPTIONS, [])
})

test("the old Pitch page fails against the pen layout", () => {
  const penLayout = readJson(
    "../../../../../apps/web/src/features/coming-soon/design/pitch.layout.json"
  )
  const old = readJson("fixtures/pitch-old-measured.json")
  assert.equal(old.frameId, penLayout.frameId)
  assert.equal(old.measured.length, penLayout.texts.length)
  const { mismatches } = comparePenLayout({
    layout: penLayout,
    measured: old.measured,
    exceptions: [],
  })
  const headline = mismatches.filter(
    (m) => m.text === "One link that sells you"
  )
  assert.deepEqual(
    headline.map((m) => m.property),
    ["x", "y", "fontSize", "letterSpacing", "color"]
  )
  assert.ok(mismatches.length > 50)
  assert.ok(mismatches.some((m) => m.property === "text"))
})

const tokens = {
  "--foreground": "rgba(26, 26, 26, 1)",
  "--muted-foreground": "rgba(89, 89, 91, 1)",
}
const small = (color) => ({ fontSize: 13, fontWeight: 400, color })

test("a pen colour darker than any token matches the nearest token", () => {
  const pen = small("rgba(17, 17, 17, 1)")
  assert.equal(colorMatches(pen, small("rgba(26, 26, 26, 1)"), tokens), true)
  assert.equal(colorMatches(pen, small("rgba(26, 26, 26, 1)"), {}), false)
})

test("a token far from the pen colour does not match", () => {
  const pen = small("rgba(138, 138, 142, 1)")
  assert.equal(colorMatches(pen, small("rgba(89, 89, 91, 1)"), tokens), false)
})

test("a faint pen grey matches the nearest grey that meets AA", () => {
  const pen = small("rgba(138, 138, 142, 1)")
  assert.equal(colorMatches(pen, small("rgba(89, 89, 91, 0.85)"), tokens), true)
})

test("a grey much darker than AA needs does not get the contrast floor", () => {
  const pen = small("rgba(138, 138, 142, 1)")
  assert.equal(colorMatches(pen, small("rgba(89, 89, 91, 0.9)"), tokens), false)
})

test("a grey that still fails AA does not get the contrast floor", () => {
  const pen = small("rgba(138, 138, 142, 1)")
  assert.equal(colorMatches(pen, small("rgba(89, 89, 91, 0.8)"), tokens), false)
})

test("a pen grey that fails AA does not pass by being copied exactly", () => {
  const pen = small("rgba(138, 138, 142, 1)")
  assert.equal(
    colorMatches(pen, small("rgba(138, 138, 142, 1)"), tokens),
    false
  )
})

test("white text on a dark fill is judged against that fill", () => {
  const onDark = {
    ...small("rgba(255, 255, 255, 1)"),
    background: "rgba(17, 17, 17, 1)",
  }
  const app = { ...onDark, background: "rgba(26, 26, 26, 1)" }
  assert.equal(colorMatches(onDark, app, tokens), true)
})

test("a pen colour that passes AA still fails when the app text is unreadable", () => {
  const pen = {
    ...small("rgba(255, 255, 255, 1)"),
    background: "rgba(17, 17, 17, 1)",
  }
  const app = { ...pen, background: "rgba(255, 255, 255, 1)" }
  assert.equal(colorMatches(pen, app, tokens), false)
})
