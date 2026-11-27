import assert from "node:assert/strict"
import { test } from "node:test"

import { detect, detectFirstKey } from "./lib/paper-keystroke-work.mjs"

const steadyKey = {
  blocksLaidOut: 1,
  pagesPaginated: 1,
  pages: [1],
  lines: 1,
  caretWrites: 2,
  suggestionWrites: 0,
  reactCommits: 0,
}

test("an edit can reshape one block and redraw the line and caret", () => {
  assert.deepEqual(detect(steadyKey), [])
  assert.deepEqual(detect({ ...steadyKey, lines: 2 }), [])
})

test("an edit on page two catches extra editor and browser work", () => {
  assert.deepEqual(
    detect({
      blocksLaidOut: 41,
      pagesPaginated: 3,
      pages: [0, 1, 2],
      lines: 41,
      caretWrites: 4,
      suggestionWrites: 6,
      reactCommits: 1,
    }),
    [
      "expected one block to be shaped",
      "expected one page to be paginated",
      "DOM writes reached outside the edited page",
      "expected DOM writes on one or two lines",
      "caret geometry was rewritten",
      "suggestion controls changed",
      "React committed during typing",
    ]
  )
})

test("a first key leaves chrome renders and schema compiles for later", () => {
  assert.deepEqual(
    detectFirstKey({ keyTaskCommits: 0, keyTaskCompiles: 0 }),
    []
  )
})

test("a first key that renders chrome or compiles code in its task is caught", () => {
  assert.deepEqual(detectFirstKey({ keyTaskCommits: 1, keyTaskCompiles: 9 }), [
    "React committed inside the first key's task",
    "code was compiled inside the first key's task",
  ])
})
