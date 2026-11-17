import assert from "node:assert/strict"
import test from "node:test"

import { screenReport } from "./check-screen.mjs"
import { PROPERTIES } from "./compare.mjs"
import { DESIGN_MAP, validateDesignMap } from "./design-map.mjs"
import {
  GROK_COACH_PAGE_COLUMN,
  LINEAR_COACH_PAGE_COMPOSER,
  LINEAR_COACH_PANEL_COMPOSER,
  WORD_SIZED_WRITING_PAGE,
  LINEAR_PAPER_DOCUMENT,
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
    [
      "paper-blank",
      "paper-typed",
      "paper-letter-blank",
      "paper-imported-formatted",
      "paper-rich",
      "paper-rich-selection",
      "paper-rich-outline",
    ]
  )
  for (const row of sheets) {
    assert.deepEqual(row.ownerDecision, {
      ...WORD_SIZED_WRITING_PAGE,
      ...LINEAR_PAPER_DOCUMENT,
      expect: {
        ...WORD_SIZED_WRITING_PAGE.expect,
        ...LINEAR_PAPER_DOCUMENT.expect,
      },
    })
    assert.deepEqual(ownerDecisionProblems(row, row.label), [])
  }
  assert.deepEqual(Object.keys(WORD_SIZED_WRITING_PAGE.expect), [
    "width",
    ...PADDING,
  ])
  assert.deepEqual(
    DESIGN_MAP.filter((row) => row.ownerDecision && row.frame !== "LFKqV").map(
      (row) => [row.screen, row.label, row.ownerDecision]
    ),
    [
      ["paper-panel-open", "Coach composer", LINEAR_COACH_PANEL_COMPOSER],
      [
        "coach-chat-finished",
        "Coach page message column",
        GROK_COACH_PAGE_COLUMN,
      ],
      [
        "coach-chat-finished",
        "Coach page composer",
        LINEAR_COACH_PAGE_COMPOSER,
      ],
    ]
  )
})

test("the Coach chat decisions are valid rows and change only the Coach chat geometry the owner asked for", () => {
  const decisions = [
    GROK_COACH_PAGE_COLUMN,
    LINEAR_COACH_PAGE_COMPOSER,
    LINEAR_COACH_PANEL_COMPOSER,
  ]
  for (const decision of decisions) {
    const row = DESIGN_MAP.find((entry) => entry.ownerDecision === decision)
    assert.deepEqual(ownerDecisionProblems(row, row.label), [])
    assert.match(row.screen, /^(coach-chat-finished|paper-panel-open)$/)
  }
  assert.deepEqual(LINEAR_COACH_PAGE_COMPOSER.expect, {
    width: 760,
    radius: 10,
  })
  assert.deepEqual(LINEAR_COACH_PANEL_COMPOSER.expect, { radius: 10 })
  assert.deepEqual(GROK_COACH_PAGE_COLUMN.expect, { width: 760, gap: 32 })
  const panelComposer = DESIGN_MAP.find(
    (row) => row.screen === "paper-panel-open" && row.label === "Coach composer"
  )
  assert.equal(panelComposer.ownerDecision, LINEAR_COACH_PANEL_COMPOSER)
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
