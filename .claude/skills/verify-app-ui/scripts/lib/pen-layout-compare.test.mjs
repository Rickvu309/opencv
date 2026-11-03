import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  colorDistance,
  colorMatches,
  comparePenLayout,
  formatMismatch,
  PEN_LAYOUT_EXCEPTIONS,
  PENDING_EXTRAS,
  pendingExtraProblems,
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

test("an exception with an index hides only the text at that index", () => {
  const twice = layout([
    text({ text: "Same words", fontSize: 15 }),
    text({ text: "Same words", fontSize: 11 }),
  ])
  const measured = [
    text({ text: "Same words", fontSize: 11 }),
    text({ text: "Same words", fontSize: 15 }),
  ]
  const result = comparePenLayout({
    layout: twice,
    measured,
    exceptions: [exception({ text: "Same words", index: 0 })],
    today: "2026-10-28",
  })
  assert.deepEqual(
    result.mismatches.map((m) => [m.text, m.property, m.pen]),
    [["Same words", "fontSize", 11]]
  )
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

const extra = (over = {}) => ({
  kind: "control",
  text: "Collapse sidebar",
  x: 200,
  y: 12,
  width: 24,
  height: 24,
  ...over,
})
const runExtras = (extras, exceptions = [], extraKinds = undefined) =>
  comparePenLayout({
    layout: layout([text()]),
    measured: [text()],
    extras,
    extraKinds,
    exceptions,
    today: "2026-10-28",
  })

test("a control the frame lacks fails as an extra", () => {
  const result = runExtras([extra()])
  assert.deepEqual(properties(result), ["extra"])
  assert.equal(result.mismatches[0].text, "Collapse sidebar")
  assert.equal(result.mismatches[0].pen, "absent")
  assert.match(
    formatMismatch(layout([text()]), result.mismatches[0]),
    /^FAIL TEST1 \/test "Collapse sidebar" extra: pen absent app control at 200,12$/
  )
})

test("a text the frame lacks fails as an extra", () => {
  const result = runExtras(
    [extra({ kind: "text", text: "Helper line the frame hides" })],
    [],
    ["text", "heading", "control"]
  )
  assert.deepEqual(properties(result), ["extra"])
  assert.deepEqual(
    runExtras([extra({ kind: "text", text: "Helper line the frame hides" })])
      .mismatches,
    []
  )
})

test("a heading in another case is missing and names the frame text", () => {
  const result = comparePenLayout({
    layout: layout([text({ text: "Your Letters" })]),
    measured: [null],
    extras: [extra({ kind: "heading", text: "Your letters" })],
    today: "2026-10-28",
  })
  assert.deepEqual(properties(result), ["text", "extra"])
  assert.equal(result.mismatches[1].pen, '"Your Letters"')
})

test("a frame with no extras passes", () => {
  assert.deepEqual(runExtras([]).mismatches, [])
})

test("an extra exception hides the extra while live and fails when expired", () => {
  const hide = exception({
    text: "Collapse sidebar",
    property: "extra",
  })
  assert.deepEqual(runExtras([extra()], [hide]).mismatches, [])
  const prefixed = exception({
    text: undefined,
    textStartsWith: "Collapse",
    property: "extra",
  })
  assert.deepEqual(runExtras([extra()], [prefixed]).mismatches, [])
  assert.deepEqual(
    properties(runExtras([extra()], [{ ...hide, until: "2026-01-01" }])),
    ["exception", "extra"]
  )
})

test("an extra exception for a control that no longer renders fails as stale", () => {
  const hide = exception({ text: "Collapse sidebar", property: "extra" })
  const result = runExtras([], [hide])
  assert.deepEqual(properties(result), ["exception"])
  assert.equal(result.mismatches[0].app, "stale, the app no longer shows it")
  assert.deepEqual(
    comparePenLayout({
      layout: layout([text()]),
      measured: [text()],
      exceptions: [hide],
      reportStale: false,
      today: "2026-10-28",
    }).mismatches,
    []
  )
})

test("an expired extra exception fails even when its control is gone", () => {
  const gone = exception({
    text: "Collapse sidebar",
    property: "extra",
    until: "2026-10-01",
  })
  for (const reportStale of [true, false]) {
    const result = comparePenLayout({
      layout: layout([text()]),
      measured: [text()],
      exceptions: [gone],
      reportStale,
      today: "2026-10-28",
    })
    assert.deepEqual(properties(result), ["exception"])
    assert.equal(result.mismatches[0].app, "expired")
  }
})

test("a pending list passed in replaces the shipped one", () => {
  const pendingOnly = exception({ text: "Collapse sidebar", property: "extra" })
  const result = comparePenLayout({
    layout: layout([text()]),
    measured: [text()],
    extras: [extra()],
    exceptions: [],
    pendingExtras: [pendingOnly],
    today: "2026-10-28",
  })
  assert.deepEqual(result.mismatches, [])
})

const iconAt = (x, y) => ({ icon: "x", x, y, size: 16 })
const runDrawn = (marks, controlOver = {}) =>
  comparePenLayout({
    layout: { ...layout([text()]), ...marks },
    measured: [text()],
    extras: [extra(controlOver)],
    today: "2026-10-28",
  })

test("an icon-only control sitting on a frame icon is accounted for", () => {
  assert.deepEqual(runDrawn({ icons: [iconAt(204, 16)] }).mismatches, [])
  assert.deepEqual(
    runDrawn({ icons: [iconAt(212, 20)] }, { x: 205 }).mismatches,
    []
  )
})

test("an icon-only control far from every frame icon still fails", () => {
  assert.deepEqual(properties(runDrawn({ icons: [iconAt(600, 400)] })), [
    "extra",
  ])
  assert.deepEqual(properties(runDrawn({})), ["extra"])
})

test("a control on a small drawn box is accounted for", () => {
  const box = { box: "Digit 4", x: 200, y: 12, width: 48, height: 56 }
  assert.deepEqual(runDrawn({ boxes: [box] }).mismatches, [])
})

test("a control on a frame text the app did not show is accounted for", () => {
  const result = comparePenLayout({
    layout: layout([text({ x: 200, y: 12, width: 60, height: 20 })]),
    measured: [null],
    extras: [extra()],
    today: "2026-10-28",
  })
  assert.deepEqual(properties(result), ["text"])
})

test("a frame icon does not account for a heading", () => {
  const result = comparePenLayout({
    layout: { ...layout([text()]), icons: [iconAt(204, 16)] },
    measured: [text()],
    extras: [extra({ kind: "heading", text: "Not in the frame" })],
    today: "2026-10-28",
  })
  assert.deepEqual(properties(result), ["extra"])
})

test("only the chosen kinds of extra count", () => {
  const result = comparePenLayout({
    layout: layout([text()]),
    measured: [text()],
    extras: [extra({ kind: "text", text: "Plain" }), extra()],
    extraKinds: ["control", "heading"],
  })
  assert.deepEqual(
    result.mismatches.map((m) => m.text),
    ["Collapse sidebar"]
  )
})

const PENDING_KINDS = ["drift", "fenced", "data", "unexplained"]

test("every pending extra names an issue, a date, a frame, a kind and a reason", () => {
  for (const entry of PENDING_EXTRAS) {
    assert.match(entry.issue, /^#\d+$/)
    assert.match(entry.until, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(entry.frameId)
    assert.ok(entry.text || entry.textStartsWith)
    assert.ok(PENDING_KINDS.includes(entry.kind), entry.kind)
    assert.ok(entry.reason.length > 20, entry.reason)
  }
})

test("a pending extra is listed once", () => {
  const keys = PENDING_EXTRAS.map(
    (entry) => `${entry.frameId}|${entry.text ?? entry.textStartsWith}`
  )
  assert.equal(new Set(keys).size, keys.length)
})

const designFrameIds = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../apps/web/src/test/design-frames.json",
      import.meta.url
    ),
    "utf8"
  )
).frames.map((frame) => frame.id)

const pendingEntry = (over = {}) => ({
  frameId: designFrameIds[0],
  text: "Location",
  issue: "#951",
  until: "2026-12-01",
  ...over,
})

test("every pending extra names a frame in design-frames.json, whichever screen runs", () => {
  assert.deepEqual(
    pendingExtraProblems({
      entries: PENDING_EXTRAS,
      frameIds: designFrameIds,
      today: "2000-01-01",
    }),
    []
  )
})

test("a pending extra fails on a frame id that design-frames.json lacks", () => {
  assert.deepEqual(
    pendingExtraProblems({
      entries: [pendingEntry({ frameId: "NoSuchFrame" })],
      frameIds: designFrameIds,
      today: "2026-11-03",
    }),
    ['NoSuchFrame "Location": frame is not in design-frames.json']
  )
})

test("a pending extra fails after its date even when no driver compares its frame", () => {
  assert.deepEqual(
    pendingExtraProblems({
      entries: [pendingEntry({ until: "2026-11-02" })],
      frameIds: designFrameIds,
      today: "2026-11-03",
    }),
    [`${designFrameIds[0]} "Location": pending until 2026-11-02 (#951)`]
  )
})

test("a pending extra on its last day still passes", () => {
  assert.deepEqual(
    pendingExtraProblems({
      entries: [pendingEntry({ until: "2026-11-03" })],
      frameIds: designFrameIds,
      today: "2026-11-03",
    }),
    []
  )
})
