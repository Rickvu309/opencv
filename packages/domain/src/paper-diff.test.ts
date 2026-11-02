import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { diffPaperContent } from "./paper-diff.ts"
import { cvCodecToBlocks } from "./paper-blocks/codec.ts"
import { emptyCvDocument, type CvDocument } from "./paper-codecs.ts"
import type { CvBlockDocument } from "./paper-blocks/document.ts"

function fixture(): CvDocument {
  return {
    ...emptyCvDocument(),
    name: "Ada",
    summary: "Ships interview notes.",
    experience: [
      {
        role: "Discovery lead",
        company: "UIT",
        period: "2024",
        bullets: ["Ran interviews"],
      },
    ],
  }
}

function withLines(document: CvDocument): CvBlockDocument {
  const blocks = cvCodecToBlocks(document)
  blocks.sections.push(
    {
      id: "sec-act",
      kind: "activities",
      blocks: [{ id: "act-1", type: "text", text: "Debate club" }],
    },
    {
      id: "sec-aw",
      kind: "awards",
      blocks: [{ id: "aw-1", type: "text", text: "Dean list" }],
    }
  )
  return blocks
}

describe("diffPaperContent version 2", () => {
  it("reports a changed bullet and a changed award", () => {
    const before = withLines(fixture())
    const after = structuredClone(before)
    const experience = after.sections.find(
      (section) => section.kind === "experience"
    )
    const role = experience?.blocks.find(
      (block) => block.type === "experience-entry"
    )
    if (role?.type === "experience-entry")
      role.bullets[0]!.text = "Ran the room"
    const awards = after.sections.find((section) => section.kind === "awards")
    const award = awards?.blocks[0]
    if (award?.type === "text") award.text = "Chancellor list"
    const hunks = diffPaperContent("cv", before, after)
    const added = hunks.flatMap((hunk) =>
      hunk.lines.filter((line) => line.kind === "add").map((line) => line.text)
    )
    assert.ok(added.includes("Ran the room"))
    assert.ok(added.includes("Chancellor list"))
    assert.equal(hunks.filter((hunk) => hunk.section === "Awards").length, 1)
  })

  it("still diffs two version 1 documents", () => {
    const before = fixture()
    const after = { ...fixture(), summary: "A new summary." }
    const hunks = diffPaperContent("cv", before, after)
    assert.ok(hunks.some((hunk) => hunk.section === "Summary"))
  })

  it("diffs a version 1 document against a version 2 document", () => {
    const before = fixture()
    const after = cvCodecToBlocks({ ...before, summary: "A new summary." })
    const hunks = diffPaperContent("cv", before, after)
    const changed = hunks.flatMap((hunk) =>
      hunk.lines.filter((line) => line.kind !== "eq").map((line) => line.text)
    )
    assert.ok(changed.includes("A new summary."))
    assert.ok(hunks.some((hunk) => hunk.section === "Summary"))
  })
})

describe("diffPaperContent letters", () => {
  it("still diffs a body-only letter by paragraph", () => {
    const hunks = diffPaperContent(
      "letter",
      { markdown: "One.\n\nTwo." },
      { markdown: "One.\n\nTwo changed." }
    )
    assert.deepEqual(
      hunks.map((hunk) => hunk.section),
      ["Paragraph 2"]
    )
  })

  it("makes one hunk per changed part", () => {
    const before = { markdown: "Body.", sender: "Linh" }
    const after = {
      markdown: "Body.",
      sender: "Linh Nguyen",
      date: "October 26, 2026",
      signature: "Linh",
    }
    const hunks = diffPaperContent("letter", before, after)
    assert.deepEqual(
      hunks.map((hunk) => hunk.sectionId),
      ["letter-sender", "letter-date", "letter-signature"]
    )
    assert.deepEqual(hunks[0]?.lines, [
      { kind: "del", text: "Linh" },
      { kind: "add", text: "Linh Nguyen" },
    ])
  })

  it("reports a header-only change that the body diff would miss", () => {
    const hunks = diffPaperContent(
      "letter",
      { markdown: "Same." },
      { markdown: "Same.", recipient: "Hiring Team\nAcme" }
    )
    assert.equal(hunks.length, 1)
    assert.equal(hunks[0]?.section, "Recipient")
  })

  it("reports no hunk when nothing changed", () => {
    const letter = { markdown: "Same.", closing: "Best," }
    assert.deepEqual(diffPaperContent("letter", letter, { ...letter }), [])
  })
})
