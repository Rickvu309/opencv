import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { blankCv, mergeLegacyEdit } from "./paper-doc/index.ts"

describe("mergeLegacyEdit", () => {
  it("returns the current paper when both sides match", () => {
    const paper = blankCv()
    assert.deepEqual(mergeLegacyEdit(paper, blankCv()), paper)
  })
})
