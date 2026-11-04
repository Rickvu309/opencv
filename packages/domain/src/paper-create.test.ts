import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { paperContract } from "./paper-contract.ts"
import { blankCv, blankLetter } from "./paper-doc/index.ts"

const paperCreateInputSchema = paperContract["paper.create"].input

describe("paper.create document", () => {
  it("accepts a missing document and a v3 paper of the same kind", () => {
    assert.equal(paperCreateInputSchema.safeParse({ kind: "cv" }).success, true)
    assert.equal(
      paperCreateInputSchema.safeParse({ kind: "cv", document: blankCv() })
        .success,
      true
    )
    assert.equal(
      paperCreateInputSchema.safeParse({
        kind: "letter",
        document: blankLetter(),
      }).success,
      true
    )
  })

  it("refuses a document that is not v3", () => {
    const parsed = paperCreateInputSchema.safeParse({
      kind: "cv",
      document: {
        version: 1,
        header: { name: "Lan" },
        experience: [
          { role: "Builder", company: "Campus", bullets: ["Shipped"] },
        ],
      },
    })
    assert.equal(parsed.success, false)
  })

  it("refuses a v3 document whose kind does not match", () => {
    const parsed = paperCreateInputSchema.safeParse({
      kind: "cv",
      document: blankLetter(),
    })
    assert.equal(parsed.success, false)
  })
})
