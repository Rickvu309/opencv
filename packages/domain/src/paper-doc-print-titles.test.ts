import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { blankCv, cvPrintModel, type CvPaper } from "./paper-doc/index.ts"
import { sectionMarker } from "./paper-doc/document.ts"
import { nodeIdSchema } from "./paper-doc/nodes.ts"

function withSecondExperience(document: CvPaper, firstTitle: string): CvPaper {
  const blocks = [
    ...document.blocks,
    sectionMarker("experience", nodeIdSchema.parse("experience-section")),
  ].map((block) =>
    block.type === "section" && block.kind === "experience"
      ? { ...block, title: firstTitle }
      : block
  )
  const second = {
    id: "volunteer-section",
    type: "section" as const,
    kind: "experience" as const,
    title: "Volunteer work",
  }
  return { ...document, blocks: [...blocks, second] }
}

describe("section titles in the print model", () => {
  it("keeps the template word when a later section of the same kind is renamed", () => {
    const printed = cvPrintModel(
      withSecondExperience(blankCv(), "Experience"),
      "product"
    )
    assert.equal(printed.sectionTitles?.experience, undefined)
  })

  it("takes the title of the first section of a kind", () => {
    const printed = cvPrintModel(
      withSecondExperience(blankCv(), "Selected roles"),
      "product"
    )
    assert.equal(printed.sectionTitles?.experience, "Selected roles")
  })
})
