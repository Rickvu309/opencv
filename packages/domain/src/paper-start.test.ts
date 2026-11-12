import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { paperContract } from "./paper-contract.ts"
import { paperStartInputSchema } from "./paper-start.ts"

const jobId = "11111111-1111-4111-8111-111111111111"

describe("paper.start takes no words of the Coach's", () => {
  it("accepts a kind, a template for a CV, a name and a Job", () => {
    assert.equal(paperStartInputSchema.safeParse({ kind: "cv" }).success, true)
    assert.equal(
      paperStartInputSchema.safeParse({
        kind: "letter",
        name: "Cover letter, Lumiere",
        jobId,
      }).success,
      true
    )
    assert.equal(
      paperStartInputSchema.safeParse({ kind: "cv", templateId: "modern" })
        .success,
      true
    )
  })

  it("refuses free text, a block document and a template on a letter", () => {
    for (const extra of [
      { lines: ["Led a team of ten"] },
      { text: "Led a team of ten" },
      { document: { kind: "cv" } },
      { content: "Led a team of ten" },
    ])
      assert.equal(
        paperStartInputSchema.safeParse({ kind: "cv", ...extra }).success,
        false,
        JSON.stringify(extra)
      )
    assert.equal(
      paperStartInputSchema.safeParse({ kind: "letter", templateId: "simple" })
        .success,
      false
    )
    assert.equal(
      paperStartInputSchema.safeParse({ kind: "cv", name: "x".repeat(500) })
        .success,
      false
    )
  })

  it("waits for the person, and the older block create is closed to the Coach", () => {
    assert.equal(paperContract["paper.start"].coach, "confirm")
    assert.equal(paperContract["paper.start"].delegate, undefined)
    assert.equal(paperContract["paper.create"].coach, "never")
    assert.equal(paperContract["paper.canvas"].coach, "never")
  })
})
