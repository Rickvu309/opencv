import { describe, expect, it } from "vitest"
import {
  emptyCvDocument,
  type CvBlockDocument,
} from "@workspace/domain"

import { deleteBlock, dropBlock, readEditorDocument } from "./paper-block-ops.ts"

const document: CvBlockDocument = {
  version: 2,
  header: { name: "", email: "", phone: "", city: "", linkedin: "" },
  sections: [
    {
      id: "summary",
      kind: "summary",
      blocks: [{ id: "sum", type: "text", text: "Line" }],
    },
    {
      id: "experience",
      kind: "experience",
      blocks: [{ id: "role", type: "text", text: "Role" }],
    },
  ],
}

describe("block ops", () => {
  it("removes a non-starter section when its last block goes", () => {
    const next = deleteBlock(document, "sum")
    expect(next.sections.map((section) => section.kind)).toEqual(["experience"])
  })

  it("keeps an empty experience section", () => {
    const next = deleteBlock(document, "role")
    expect(next.sections.map((section) => section.kind)).toEqual([
      "summary",
      "experience",
    ])
    expect(next.sections[1]?.blocks).toEqual([])
  })

  it("moves a block onto another section", () => {
    const next = dropBlock(document, "role", "section:summary")
    expect(next.sections[0]?.blocks.map((block) => block.id)).toEqual([
      "sum",
      "role",
    ])
  })

  it("reads a version 1 CV as version 2", () => {
    const next = readEditorDocument(emptyCvDocument())
    expect(next.version).toBe(2)
    expect(next.header.name).toBe("")
  })
})
