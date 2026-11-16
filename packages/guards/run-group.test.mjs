import assert from "node:assert/strict"
import test from "node:test"
import { discoverTests } from "./run-tests.mjs"
import { testGroup, TEMP_DIRS } from "./run-group.mjs"

test("the two guards groups cover every discovered test file exactly once", () => {
  const complete = discoverTests()
  const ordinary = testGroup(complete, "ordinary")
  const dedicated = testGroup(complete, "temp-dirs")
  assert.deepEqual(dedicated, [TEMP_DIRS])
  assert.deepEqual([...ordinary, ...dedicated].sort(), complete)
  assert.equal(new Set([...ordinary, ...dedicated]).size, complete.length)
  assert.throws(() => testGroup(complete, "typo"), /unknown guards group/)
  assert.throws(() => testGroup(complete), /unknown guards group/)
})
