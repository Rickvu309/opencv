import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { runUi } from "../cli.mjs"
import { fakePorts } from "../fake-ports.mjs"
import { EXPECTED_FAILURES, pickRows } from "./command.mjs"
import { cvText, keystrokeStats, lineStart } from "./keystrokes.mjs"
import { ROWS } from "./rows.mjs"
import {
  STATUS,
  resultTable,
  unknownPins,
  walkRows,
  walkSummary,
} from "./run.mjs"
import { wordBytesFacts, wordFileFacts } from "./word-file.mjs"

const block = (type, text, extra = {}) => ({
  type,
  level: null,
  depth: 1,
  text,
  bold: false,
  links: [],
  ...extra,
})
const p = (text, extra) => block("paragraph", text, extra)
const bullet = (text, extra) => block("bulletListItem", text, extra)
const richPage = [
  block("heading", "Ada Nguyen", { level: 1 }),
  block("heading", "Experience", { level: 2 }),
  bullet("Led the team"),
  bullet("Shipped the app"),
  p("Portfolio site", { links: ["https://example.com/ada"] }),
]
const both = [p("Tab one words tab two words")]

const GOOD = {
  "select-all-end-type": { blocks: [p("Alpha"), p("Beta"), p("Gamma")] },
  "select-all-arrow-right-type": { blocks: [p("Alpha"), p("BetaZ")] },
  "list-enter-continues": { blocks: [bullet("One"), bullet("Two")] },
  "list-tab-nests": { blocks: [bullet("One"), bullet("Nested", { depth: 2 })] },
  "list-empty-enter-ends": {
    blocks: [bullet("One"), bullet("Two"), p("After")],
  },
  "paste-rich-word": { blocks: richPage },
  "paste-rich-docs": { blocks: richPage },
  "paste-rich-web": { blocks: richPage },
  "paste-plain-lines": {
    blocks: [p("Line one"), p("Line two"), p("Line three")],
  },
  "bold-three-paragraphs": {
    blocks: ["First", "Second", "Third"].map((text) => p(text, { bold: true })),
  },
  "undo-after-paste": { blocks: [p("Typed first.")] },
  "pdf-download": { offered: true, isPdf: true },
  "print-only-page": { chrome: [] },
  "page-default-a4": {
    page: { width: 11906, height: 16838 },
    headings: [],
    hyperlinks: 0,
  },
  "word-keeps-headings-links": {
    page: { width: 11906, height: 16838 },
    headings: ["Title", "Heading1", "Heading2"],
    hyperlinks: 1,
  },
  "phone-caret-type": { caret: true, blocks: [p("Phone words")] },
  "two-tabs": { first: both, second: both },
  "reload-keeps-text": { blocks: [p("Kept after reload")] },
}

const BAD = {
  "select-all-end-type": { blocks: [p("Alpha"), p(""), p("Gamma")] },
  "select-all-arrow-right-type": { blocks: [p("Z")] },
  "list-enter-continues": { blocks: [bullet("One"), p("Two")] },
  "list-tab-nests": { blocks: [bullet("One"), p("Nested")] },
  "list-empty-enter-ends": {
    blocks: [bullet("One"), p("Two"), p(""), p("After")],
  },
  "paste-rich-word": { blocks: [p("")] },
  "paste-rich-docs": { blocks: [block("heading", "Ada Nguyen", { level: 2 })] },
  "paste-rich-web": { blocks: [p("Ada Nguyen Experience Led the team")] },
  "paste-plain-lines": { blocks: [p("Line one\nLine two\nLine three")] },
  "bold-three-paragraphs": {
    blocks: [p("First"), p("Second"), p("Third", { bold: true })],
  },
  "undo-after-paste": { blocks: [p("")] },
  "pdf-download": { offered: false, isPdf: false },
  "print-only-page": { chrome: ["navigation", "toolbar"] },
  "page-default-a4": {
    page: { width: 12240, height: 15840 },
    headings: [],
    hyperlinks: 0,
  },
  "word-keeps-headings-links": {
    page: { width: 12240, height: 15840 },
    headings: ["Heading2", "Heading2"],
    hyperlinks: 0,
  },
  "phone-caret-type": { caret: false, blocks: [p("")] },
  "two-tabs": { first: both, second: [p("tab two words")] },
  "reload-keeps-text": { blocks: [p("")] },
}

function fakePerson(table) {
  let seen = null
  const actions = []
  const record = (kind) => async (value) => {
    actions.push([kind, value])
  }
  const fakeTab = (blocks, caret) => ({
    type: record("type"),
    press: record("press"),
    paste: record("paste"),
    pause: record("pause"),
    typeAtEnd: record("typeAtEnd"),
    tapPage: record("tap"),
    caretInPage: async () => caret,
    waitForText: record("waitForText"),
    blocks: async () => blocks,
  })
  return {
    actions,
    begin: async (row) => {
      seen = table[row.id]
    },
    end: async () => {
      seen = null
    },
    openBlankCv: record("openBlankCv"),
    openImportedCv: record("openImportedCv"),
    type: record("type"),
    press: record("press"),
    chord: record("chord"),
    paste: record("paste"),
    pause: record("pause"),
    waitSaved: record("waitSaved"),
    reload: record("reload"),
    blocks: async () => seen.blocks,
    downloadWord: async () => seen,
    downloadPdf: async () => seen,
    printView: async () => seen,
    onPhone: (work) => work(fakeTab(seen.blocks, seen.caret)),
    inTwoTabs: (work) => work(fakeTab(seen.first), fakeTab(seen.second)),
  }
}

let clock = 0
const now = () => (clock += 5)

test("every row has fixtures for a page that passes it and one that fails it", () => {
  const ids = ROWS.map((row) => row.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(Object.keys(GOOD).sort(), [...ids].sort())
  assert.deepEqual(Object.keys(BAD).sort(), [...ids].sort())
})

test("a page that works like Google Docs passes every row", async () => {
  const results = await walkRows({
    rows: ROWS,
    person: fakePerson(GOOD),
    expected: {},
    now,
  })
  for (const result of results)
    assert.equal(result.status, STATUS.pass, `${result.id}: ${result.problem}`)
  assert.equal(walkSummary(results).ok, true)
})

test("a broken page fails every row with a reason a person can read", async () => {
  const results = await walkRows({
    rows: ROWS,
    person: fakePerson(BAD),
    expected: {},
    now,
  })
  for (const result of results) {
    assert.equal(result.status, STATUS.fail, result.id)
    assert.ok(result.problem.length > 10, `${result.id}: ${result.problem}`)
  }
  assert.equal(walkSummary(results).failed, ROWS.length)
})

test("select all then a key acts through real keys, not a shortcut into the model", async () => {
  const person = fakePerson(GOOD)
  const row = ROWS.find((item) => item.id === "select-all-end-type")
  await walkRows({ rows: [row], person, expected: {}, now })
  assert.deepEqual(
    person.actions.filter(([kind]) => kind === "press" || kind === "chord"),
    [
      ["chord", ["Control+a", "Delete"]],
      ["press", "Enter"],
      ["chord", ["Control+a", "End", "Enter"]],
    ]
  )
})

test("a pinned failure keeps the walk green and a pinned row that passes must be unpinned", async () => {
  const rows = ROWS.filter((row) =>
    ["two-tabs", "reload-keeps-text"].includes(row.id)
  )
  const table = {
    "two-tabs": BAD["two-tabs"],
    "reload-keeps-text": GOOD["reload-keeps-text"],
  }
  const pinnedFail = await walkRows({
    rows,
    person: fakePerson(table),
    expected: { "two-tabs": "#2202" },
    now,
  })
  assert.deepEqual(
    pinnedFail.map((result) => result.status),
    [STATUS.expectedFail, STATUS.pass]
  )
  assert.equal(walkSummary(pinnedFail).ok, true)
  const flipped = await walkRows({
    rows,
    person: fakePerson(table),
    expected: { "reload-keeps-text": "#2202" },
    now,
  })
  assert.deepEqual(
    flipped.map((result) => result.status),
    [STATUS.fail, STATUS.nowPasses]
  )
  assert.equal(walkSummary(flipped).failed, 2)
  assert.match(
    resultTable(flipped).join("\n"),
    /\| reload-keeps-text \| Save \| now-passes \|/
  )
})

test("a step that throws fails its row and the walk goes on", async () => {
  const person = {
    ...fakePerson(GOOD),
    openBlankCv: async () => {
      throw new Error("no New button\nstack")
    },
  }
  const results = await walkRows({
    rows: ROWS.slice(0, 2),
    person,
    expected: {},
    now,
  })
  assert.deepEqual(
    results.map((result) => result.problem),
    ["the step threw: no New button", "the step threw: no New button"]
  )
})

test("expected failures pin only real rows and name the issue that pinned them", () => {
  const expected = JSON.parse(
    readFileSync(
      new URL(`../../../${EXPECTED_FAILURES}`, import.meta.url),
      "utf8"
    )
  )
  assert.deepEqual(unknownPins(ROWS, expected), [])
  for (const [id, pin] of Object.entries(expected))
    assert.match(pin, /^#\d+$/, id)
  assert.deepEqual(unknownPins(ROWS, { ghost: "#1" }), ["ghost"])
  assert.throws(() => pickRows(ROWS, ["ghost"]), /unknown row ghost/)
  assert.deepEqual(
    pickRows(ROWS, ["two-tabs"]).map((row) => row.id),
    ["two-tabs"]
  )
})

test("the Word reader finds heading styles, links and page size", () => {
  const xml =
    '<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr><w:hyperlink r:id="r1"/></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>'
  assert.deepEqual(wordFileFacts(xml), {
    headings: ["Heading1"],
    hyperlinks: 1,
    page: { width: 11906, height: 16838 },
  })
  const source = wordBytesFacts(
    readFileSync(new URL("../fixtures/cv-formatted.docx", import.meta.url))
  )
  const row = ROWS.find((item) => item.id === "word-keeps-headings-links")
  assert.equal(
    row.pass(source),
    null,
    "the imported fixture itself must pass the Word row"
  )
})

test("keystroke stats give p50, p95 and max over the samples", () => {
  const samples = Array.from({ length: 20 }, (_, at) => at + 1)
  assert.deepEqual(keystrokeStats(samples), {
    keys: 20,
    p50: 10,
    p95: 19,
    max: 20,
  })
  assert.deepEqual(keystrokeStats([]), {
    keys: 0,
    p50: null,
    p95: null,
    max: null,
  })
  const text = cvText({ lines: 42, wordsPerLine: 20 })
  assert.equal(text.split("\n").length, 42)
  assert.equal(text.split("\n")[21].split(" ")[0], lineStart(21))
})

test("help lists the walk and an unknown walk is refused", async () => {
  const help = await runUi(["help"], fakePorts())
  assert.ok(help.lines.some((line) => line.includes("walk paper")))
  const unknown = await runUi(["walk", "jobs"], fakePorts())
  assert.equal(unknown.code, 2)
  assert.match(unknown.lines[0], /walk takes paper, paper-lab, got jobs/)
})
