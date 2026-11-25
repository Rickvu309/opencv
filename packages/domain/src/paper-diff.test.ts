import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { diffPaperContent } from "./paper-doc/paper-diff.ts"
import { type ProofDocument } from "./paper-doc/paper.ts"

const emptyProofDocument = (): ProofDocument => ({
  viewMode: "chain",
  title: "",
  steps: [],
})

function proof(title: string, body: string): ProofDocument {
  return {
    ...emptyProofDocument(),
    title,
    steps: [
      {
        id: "step-1",
        type: "action",
        title: "Ship",
        body,
        photos: [],
      },
    ],
  }
}

describe("diffPaperContent", () => {
  it("returns no hunks for a CV or a letter", () => {
    assert.deepEqual(
      diffPaperContent("cv", { name: "Ada" }, { name: "Bea" }),
      []
    )
    assert.deepEqual(
      diffPaperContent("letter", { markdown: "One." }, { markdown: "Two." }),
      []
    )
  })

  it("diffs a proof title and a step body", () => {
    const hunks = diffPaperContent(
      "proof",
      proof("Before", "Wrote the notes"),
      proof("After", "Shipped the notes")
    )
    assert.deepEqual(
      hunks.map((hunk) => hunk.section),
      ["Title", "Ship"]
    )
    assert.deepEqual(hunks[1]?.lines, [
      { kind: "del", text: "Wrote the notes" },
      { kind: "add", text: "Shipped the notes" },
    ])
  })
})
