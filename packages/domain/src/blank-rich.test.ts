import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvSlots,
  emptyRichPaper,
  richPaperDocumentSchema,
} from "./paper-doc/index.ts"

describe("emptyRichPaper", () => {
  for (const kind of ["cv", "letter"] as const) {
    it(`creates one valid empty ${kind} document the rich editor admits`, () => {
      const document = richPaperDocumentSchema.parse(emptyRichPaper(kind))
      assert.equal(document.kind, kind)
      const sections = document.flow.children
      assert.equal(sections.length, 1)
      assert.equal(sections[0]!.start, "continuous")
      const nodes = sections[0]!.children
      if (kind === "cv") {
        assert.equal(nodes[0]!.type, "header")
        assert.deepEqual(
          nodes[0]!.children.map((field) => field.fieldKey),
          [...cvSlots.header]
        )
        for (const field of nodes[0]!.children)
          assert.deepEqual(field.content, [])
        assert.equal(nodes[1]!.type, "paragraph")
        assert.deepEqual(nodes[1]!.content, [])
        assert.equal(nodes.length, 2)
      } else {
        assert.equal(nodes.length, 1)
        assert.equal(nodes[0]!.type, "paragraph")
        assert.deepEqual(nodes[0]!.content, [])
      }
    })
  }
})
