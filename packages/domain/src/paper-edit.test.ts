import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { operation } from "./operations/paper/edit/operation.ts"

describe("paper.edit", () => {
  it("waits for the person's approval before the Coach changes a CV or Letter", () => {
    assert.equal(operation.coach, "confirm")
  })

  it("lets a connected agent only propose, never write directly", () => {
    assert.deepEqual(operation.delegate, {
      resource: "paper",
      access: "proposal",
    })
  })
})
