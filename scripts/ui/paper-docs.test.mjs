import assert from "node:assert/strict"
import test from "node:test"

import { paperDocPlan } from "./paper-docs.mjs"

test("a paper docs step names the newest documents first and fills the rest", () => {
  const plan = paperDocPlan({ count: 6, names: ["Newest CV", "Thư xin việc"] })
  assert.equal(plan.length, 6)
  assert.deepEqual(plan.at(-1), { name: "Newest CV", label: "cv" })
  assert.deepEqual(plan.at(-2), { name: "Thư xin việc", label: "letter" })
  assert.deepEqual(plan[0], { name: "CV for Company 1", label: "cv" })
  assert.deepEqual(plan[3], { name: "Letter to Company 4", label: "letter" })
})
