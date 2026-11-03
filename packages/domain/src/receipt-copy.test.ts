import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { humanizeCommandFailCopy } from "./receipt-copy.ts"

describe("humanizeCommandFailCopy", () => {
  it("keeps a human sentence", () => {
    assert.equal(
      humanizeCommandFailCopy("That job is already closed."),
      "That job is already closed."
    )
  })

  it("replaces zod dumps, regex patterns, json blobs and long text with one sentence", () => {
    const machine = [
      "Invalid input for tool job_create",
      '[{"code":"invalid_type","path":["name"]}]',
      "Expected string, received number",
      "must match /^[a-z]+$/",
      "word ".repeat(40),
      "",
    ]
    for (const message of machine) {
      assert.equal(humanizeCommandFailCopy(message), "The input wasn't valid")
    }
  })

  it("names the card id when the dumped error is about a uuid", () => {
    assert.equal(
      humanizeCommandFailCopy("Invalid uuid"),
      "That card id isn't valid"
    )
  })
})
