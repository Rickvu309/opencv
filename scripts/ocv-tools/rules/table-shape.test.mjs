import assert from "node:assert/strict"
import { statSync } from "node:fs"
import test from "node:test"
import { FIXES } from "../result.mjs"
import { RULE_GUIDES } from "./doc.mjs"
import { RULES, decide, evaluate } from "./index.mjs"

const FILE_SIZE_LIMIT_BYTES = 20000
const indexOf = (id) => RULES.findIndex((row) => row.id === id)

test("NOT_A_TASK is the first row, so decide stops before rows a folder outside any task worktree cannot gather", () => {
  assert.equal(RULES[0].id, "NOT_A_TASK")
  assert.equal(RULES[0].stop, true)
  assert.deepEqual(
    decide("save", { here: { linked: false } }).refusals.map((row) => row.id),
    ["NOT_A_TASK"]
  )
})

test("the issue gates run before READY_FOR_HUMAN, so a closed or missing issue stops the take first", () => {
  for (const gate of ["NOT_AN_ISSUE", "CLOSED"]) {
    assert.ok(indexOf(gate) < indexOf("READY_FOR_HUMAN"), gate)
    assert.equal(RULES[indexOf(gate)].stop, true, gate)
  }
})

test("a branch both local and on origin gets the local fix, in the same order as its message", () => {
  const hit = evaluate("BRANCH_EXISTS", {
    branch: { stage: "create", name: "feat/1-x", local: true, remote: true },
    issue: { n: 1 },
  })
  assert.match(hit.message, /already exists locally/)
  assert.equal(hit.fix, FIXES.BRANCH_EXISTS)
})

test("the rule table splits into guides that each stay under the file size limit", () => {
  assert.ok(RULE_GUIDES.length > 1)
  for (const guide of RULE_GUIDES) {
    assert.ok(statSync(guide.path).size <= FILE_SIZE_LIMIT_BYTES, guide.path)
  }
})
