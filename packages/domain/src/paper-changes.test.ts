import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { emptyCvDocument, emptyLetterDocument } from "./paper-codecs.ts"
import { countPaperChanges } from "./paper.ts"

describe("countPaperChanges", () => {
  it("counts one changed letter field", () => {
    assert.equal(
      countPaperChanges(emptyLetterDocument(), {
        markdown: "Thanks for reading.",
      }),
      1
    )
  })

  it("counts zero when the document is unchanged", () => {
    const letter = emptyLetterDocument()
    assert.equal(countPaperChanges(letter, { ...letter }), 0)
  })

  it("counts a changed field and a changed block", () => {
    const before = emptyCvDocument()
    const after = {
      ...before,
      summary: "Updated summary.",
      experience: [
        {
          role: "Intern",
          company: "Northwind",
          period: "2024",
          bullets: ["Shipped the board"],
        },
      ],
    }
    assert.equal(countPaperChanges(before, after), 2)
  })

  it("counts one block when a bullet inside it changes", () => {
    const block = {
      role: "Intern",
      company: "Northwind",
      period: "2024",
      bullets: ["Shipped the board"],
    }
    const before = { ...emptyCvDocument(), experience: [block] }
    const after = {
      ...before,
      experience: [{ ...block, bullets: ["Shipped the rewrite"] }],
    }
    assert.equal(countPaperChanges(before, after), 1)
  })

  it("counts a nested contact edit as one field", () => {
    const before = emptyCvDocument()
    const after = {
      ...before,
      contact: { ...before.contact, email: "ada@example.com" },
    }
    assert.equal(countPaperChanges(before, after), 1)
  })
})
