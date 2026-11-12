import assert from "node:assert/strict"
import test from "node:test"

import { screenReport } from "./check-screen.mjs"
import { PROPERTIES } from "./compare.mjs"
import { DESIGN_MAP, validateDesignMap } from "./design-map.mjs"
import {
  COUNCIL_DOCKED_COACH_COMPOSER,
  WORD_SIZED_WRITING_PAGE,
  ownerDecisionProblems,
} from "./owner-decision.mjs"
import { indexPen } from "./pen.mjs"

const PADDING = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]

const pen = indexPen({
  version: "1",
  children: [
    {
      type: "frame",
      id: "editing",
      name: "W6.4 Editing",
      width: 1440,
      height: 900,
      children: [
        {
          type: "frame",
          id: "LFKqV",
          name: "Page",
          width: 560,
          height: 700,
          cornerRadius: 2,
          padding: [44, 52],
        },
      ],
    },
  ],
})

const pageRow = (extra = {}) => ({
  screen: "paper-typed",
  label: "Writing page",
  selector: "main [contenteditable]",
  composedScreen: "W6.4 Editing",
  frame: "LFKqV",
  props: ["width", "radius", ...PADDING],
  ...extra,
})

const wordPage = {
  width: 816,
  radius: 2,
  paddingTop: 96,
  paddingRight: 96,
  paddingBottom: 96,
  paddingLeft: 96,
}

const report = (row) =>
  screenReport({
    screen: { id: "paper-typed" },
    rows: [row],
    rendered: [wordPage],
    baseline: new Map(),
    index: pen,
    tolerance: 1,
  })

test("an owner decision without a reason, a date or a checked property is a design map problem", () => {
  const bad = [
    { ...WORD_SIZED_WRITING_PAGE, reason: undefined },
    { ...WORD_SIZED_WRITING_PAGE, reason: "  " },
    { ...WORD_SIZED_WRITING_PAGE, decided: "today" },
    { ...WORD_SIZED_WRITING_PAGE, expect: {} },
    { ...WORD_SIZED_WRITING_PAGE, expect: { height: 1056 } },
  ]
  assert.deepEqual(
    bad.map((ownerDecision) =>
      ownerDecisionProblems(pageRow({ ownerDecision }), "Writing page")
    ),
    [
      ["Writing page: ownerDecision needs a reason"],
      ["Writing page: ownerDecision needs a reason"],
      ["Writing page: ownerDecision needs a decided date as YYYY-MM-DD"],
      ["Writing page: ownerDecision needs at least one expected value"],
      ["Writing page: ownerDecision sets height, which the row does not check"],
    ]
  )
  assert.deepEqual(
    validateDesignMap(
      [
        pageRow({
          ownerDecision: { decided: "2026-11-12", expect: { width: 816 } },
        }),
      ],
      PROPERTIES
    ),
    ["Writing page: ownerDecision needs a reason"]
  )
  assert.deepEqual(
    ownerDecisionProblems(
      pageRow({ ownerDecision: WORD_SIZED_WRITING_PAGE }),
      "Writing page"
    ),
    []
  )
  assert.deepEqual(ownerDecisionProblems(pageRow(), "Writing page"), [])
})

test("every writing page sheet row takes the Word size by owner decision and keeps the pen for the rest", () => {
  const sheets = DESIGN_MAP.filter((row) => row.frame === "LFKqV")
  assert.deepEqual(
    sheets.map((row) => row.screen),
    ["paper-blank", "paper-typed", "paper-letter-blank"]
  )
  for (const row of sheets)
    assert.equal(row.ownerDecision, WORD_SIZED_WRITING_PAGE)
  assert.deepEqual(Object.keys(WORD_SIZED_WRITING_PAGE.expect), [
    "width",
    ...PADDING,
  ])
  assert.deepEqual(
    DESIGN_MAP.filter((row) => row.ownerDecision && row.frame !== "LFKqV").map(
      (row) => [row.screen, row.label, row.ownerDecision]
    ),
    [
      [
        "coach-chat-finished",
        "Coach page composer",
        COUNCIL_DOCKED_COACH_COMPOSER,
      ],
    ]
  )
})

test("the council's docked composer decision changes only the height and keeps the pen width and radius", () => {
  assert.deepEqual(
    ownerDecisionProblems(
      DESIGN_MAP.find(
        (row) => row.ownerDecision === COUNCIL_DOCKED_COACH_COMPOSER
      ),
      "Coach page composer"
    ),
    []
  )
  assert.deepEqual(Object.keys(COUNCIL_DOCKED_COACH_COMPOSER.expect), [
    "height",
  ])
})

test("check measures a decided row against the decision and says it is a decision, not the pen", () => {
  const decided = report(pageRow({ ownerDecision: WORD_SIZED_WRITING_PAGE }))
  assert.equal(decided.result.failed, 0)
  const notes = decided.lines.filter((line) => line.includes("owner decision"))
  assert.equal(notes.length, 5)
  assert.match(
    notes[0],
    /^Writing page width: expects 816 by owner decision of 2026-11-12, not the pen frame LFKqV \(560\); the owner sized/
  )
  assert.match(notes[1], /paddingTop: expects 96 .*LFKqV \(44\)/)
})

test("a row without a decision is held to the pen and prints no decision", () => {
  const plain = report(pageRow())
  assert.deepEqual(
    plain.result.failures.map((failure) => failure.property),
    ["width", ...PADDING]
  )
  assert.equal(
    plain.lines.some((line) => line.includes("owner decision")),
    false
  )
})
