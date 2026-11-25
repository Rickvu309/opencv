import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvSlots,
  nativeCvDocumentSchema,
  paperDocumentSchema,
  nativePaperDocumentSchema,
  type NativeCvDocument,
} from "./paper-doc/index.ts"

function document(text = "  Việt e\u0302 😀  "): NativeCvDocument {
  return nativeCvDocumentSchema.parse({
    version: 4,
    schemaRevision: 2,
    kind: "cv",
    header: {
      id: "h",
      type: "header",
      children: cvSlots.header.map((fieldKey) => ({
        id: `h-${fieldKey}`,
        type: "cvField",
        ownerId: "h",
        fieldKey,
        content:
          fieldKey === "name" && text !== ""
            ? [
                {
                  text,
                  bold: true,
                  italic: true,
                  underline: true,
                  href: "https://example.com",
                },
              ]
            : [],
      })),
    },
    blocks: [],
  })
}

describe("private CV semantic field invariants", () => {
  it("keeps private revision 2 outside legacy and revision 1 admission", () => {
    const doc = document()
    assert.equal(paperDocumentSchema.safeParse(doc).success, false)
    assert.equal(nativePaperDocumentSchema.safeParse(doc).success, false)
    assert.equal(
      nativeCvDocumentSchema.safeParse({ ...doc, schemaRevision: 1 }).success,
      false
    )
    assert.equal(doc.header.children.length, 6)
  })
  it("refuses missing, reordered, duplicate and cross-owner fields", () => {
    const doc = document()
    const fields = doc.header.children
    for (const children of [
      fields.slice(1),
      [...fields].reverse(),
      [...fields, fields[0]],
      fields.map((field, i) => (i ? field : { ...field, ownerId: "wrong" })),
      fields.map((field, i) => (i ? field : { ...field, id: "h" })),
      fields.map((field, i) =>
        i ? field : { ...field, itemId: "unexpected" }
      ),
    ])
      assert.equal(
        nativeCvDocumentSchema.safeParse({
          ...doc,
          header: { ...doc.header, children },
        }).success,
        false
      )
  })
  it("refuses unknown styles, controls and unsupported nodes before normalization", () => {
    const doc = document()
    for (const run of [
      { text: "a\tb" },
      { text: "a\nb" },
      { text: "a\rb" },
      { text: "a", strike: true },
      { text: "a", href: "javascript:alert(1)" },
      { text: "a", bold: false },
    ]) {
      const header = {
        ...doc.header,
        children: doc.header.children.map((field, i) =>
          i ? field : { ...field, content: [run] }
        ),
      }
      assert.equal(
        nativeCvDocumentSchema.safeParse({ ...doc, header }).success,
        false
      )
    }
    assert.equal(
      nativeCvDocumentSchema.safeParse({
        ...doc,
        blocks: [{ id: "table", type: "table" }],
      }).success,
      false
    )
  })
})
