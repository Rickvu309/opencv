import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { operation } from "./operations/paper/create/operation.ts"
import { blankCv } from "./paper-doc/index.ts"

const paperCreateInputSchema = operation.input

describe("paper.create input", () => {
  it("takes a kind and an optional name for a rich blank", () => {
    assert.equal(paperCreateInputSchema.safeParse({ kind: "cv" }).success, true)
    assert.equal(
      paperCreateInputSchema.safeParse({ kind: "letter", name: "Cover" })
        .success,
      true
    )
  })

  it("refuses a starting document, and a template for anything but a CV", () => {
    assert.equal(
      paperCreateInputSchema.safeParse({ kind: "cv", document: blankCv() })
        .success,
      false
    )
    assert.equal(
      paperCreateInputSchema.safeParse({ kind: "cv", templateId: "simple" })
        .success,
      true
    )
    assert.equal(
      paperCreateInputSchema.safeParse({ kind: "letter", templateId: "simple" })
        .success,
      false
    )
  })
})
