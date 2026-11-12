import assert from "node:assert/strict"
import test from "node:test"
import {
  allScreenLines,
  measureTargets,
  rowsWithTargets,
  screenResult,
  screensToCheck,
  summarize,
  summaryLine,
  totalLine,
} from "./check-all.mjs"
import { relate, RELATIVE, PROPERTIES } from "./compare.mjs"
import { validateDesignMap } from "./design-map.mjs"

const rows = [
  { screen: "a", label: "Column", selector: ".column" },
  { screen: "a", label: "Row", selector: ".row svg", from: ".column" },
]

test("check --all takes every mapped screen once and keeps unreachable ones apart", () => {
  const screens = [
    { id: "a" },
    { id: "b" },
    { id: "c", unreachable: "needs a paced fake" },
  ]
  const map = [...rows, { screen: "c", label: "x", selector: ".x" }]
  const picked = screensToCheck(map, screens)
  assert.deepEqual(
    picked.reachable.map((screen) => screen.id),
    ["a"]
  )
  assert.deepEqual(
    picked.unreachable.map((screen) => screen.id),
    ["c"]
  )
})

test("a row with a from selector measures both and pairs them back in order", () => {
  assert.deepEqual(
    measureTargets(rows).map((target) => target.selector),
    [".column", ".row svg", ".column"]
  )
  const measured = [
    { items: [{ x: 10 }] },
    { items: [{ x: 10 }, { x: 42 }] },
    { items: [{ x: 10, y: 0, width: 100, height: 20 }] },
  ]
  const paired = rowsWithTargets(rows, measured)
  assert.equal(paired[0].from, undefined)
  assert.deepEqual(paired[1].items, [{ x: 10 }, { x: 42 }])
  assert.equal(paired[1].from.width, 100)
})

test("relations read the pitch from the second match and offsets from the from box", () => {
  const icon = { x: 110, y: 52, width: 16, height: 16 }
  const related = relate([icon, { ...icon, x: 142 }], {
    x: 110,
    y: 0,
    width: 720,
    height: 40,
  })
  assert.equal(related.pitch, 32)
  assert.equal(related.left, 0)
  assert.equal(related.below, 12)
  assert.equal(related.centerOffset, 8 - 360)
  assert.equal(relate([], null), null)
  assert.equal(relate([icon], null).pitch, undefined)
})

test("a relative property without a from selector is a design map problem", () => {
  for (const prop of RELATIVE) assert.ok(PROPERTIES.includes(prop))
  const problems = validateDesignMap(
    [
      {
        screen: "a",
        label: "Row",
        selector: ".row",
        frame: "f",
        composedScreen: "W1.1 Continue",
        props: ["left", "pitch"],
      },
    ],
    PROPERTIES
  )
  assert.deepEqual(problems, ["Row: left needs a from selector"])
})

test("the summary prints one line per screen and a total that fails on any failure", () => {
  const table = [
    {
      label: "Card",
      property: "radius",
      design: 10,
      rendered: 0,
      difference: -10,
      status: "mismatch",
    },
  ]
  const results = [
    screenResult("apply-board", [...table, { status: "ok" }], table),
    { screen: "sign-in", compared: 6, failed: 0, failures: [] },
    { screen: "coach-chat-streaming", error: "unreachable" },
  ]
  assert.deepEqual(results.map(summaryLine), [
    "apply-board: FAIL, 2 compared, 1 failed",
    "sign-in: pass, 6 compared, 0 failed",
    "coach-chat-streaming: error unreachable",
  ])
  const total = summarize(results, 35)
  assert.equal(total.ok, false)
  assert.deepEqual(total.failedScreens, ["apply-board", "coach-chat-streaming"])
  assert.equal(
    totalLine(total),
    "total: FAIL, 3 screens, 8 compared, 1 failed, 35s"
  )
  assert.equal(results[0].failures[0].element, "Card")
  assert.equal(summarize([results[1]], 1).ok, true)
})

test("check --all prints the owner-decision lines and the changed-since-main count of each screen", () => {
  const owner =
    "Paper writing page width: expects 816 by owner decision of 2026-11-12, not the pen frame abc (560); the owner sized it"
  const lines = allScreenLines([
    {
      result: {
        screen: "paper-editor",
        compared: 4,
        failed: 2,
        newFailed: 1,
        knownFailed: 1,
        changedFailed: 1,
      },
      ownerLines: [owner],
    },
    {
      result: { screen: "coach-home", compared: 3, failed: 0 },
      ownerLines: [],
    },
    { result: { screen: "settings", error: "unreachable" } },
  ])
  assert.deepEqual(lines, [
    "paper-editor: FAIL, 4 compared, 2 failed, 1 already failing on main, 1 changed since main",
    `  ${owner}`,
    "coach-home: pass, 3 compared, 0 failed",
    "settings: error unreachable",
  ])
})
