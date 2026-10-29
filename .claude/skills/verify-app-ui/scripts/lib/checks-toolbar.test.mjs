import assert from "node:assert/strict"
import test from "node:test"

import { cvToolbarCheck } from "./checks.mjs"

test("30: visible, named Undo on the live CV toolbar passes", () => {
  assert.deepEqual(cvToolbarCheck([{ label: "Undo" }]), {
    pass: true,
    undo: true,
    reject: false,
  })
})

test("30: missing Undo fails regardless of other controls", () => {
  assert.equal(cvToolbarCheck([{ label: "Download PDF" }]).pass, false)
})

test("30: Coach Reject is optional and recorded when present", () => {
  assert.equal(cvToolbarCheck([{ label: "Undo" }], []).pass, true)
  assert.deepEqual(cvToolbarCheck([{ label: "Undo" }], [{ label: "Reject" }]), {
    pass: true,
    undo: true,
    reject: true,
  })
})
