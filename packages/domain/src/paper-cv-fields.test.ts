import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  cvSlots,
  nativeCvDocumentSchema,
  paperDocumentSchema,
  nativePaperDocumentSchema,
  resolveCvField,
  replaceCvFieldRange,
  formatCvFieldRange,
  richTextOf,
  type NativeCvDocument,
  type CvFieldRange,
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
function range(doc: NativeCvDocument, from: number, to: number): CvFieldRange {
  const field = doc.header.children[0]
  if (!field || field.type !== "cvField") throw new Error("Missing name")
  return {
    ownerId: doc.header.id,
    fieldId: field.id,
    fieldKey: "name",
    from,
    to,
  }
}
function selected(doc: NativeCvDocument) {
  return resolveCvField(doc, range(doc, 0, 0)).content
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
  it("validates every target component", () => {
    const doc = document()
    const target = range(doc, 0, 0)
    for (const bad of [
      { ...target, ownerId: doc.header.children[0]?.id },
      { ...target, fieldId: doc.header.id },
      { ...target, fieldKey: "email" },
      { ...target, itemId: doc.header.id },
    ])
      assert.throws(() => resolveCvField(doc, bad as typeof target))
  })
  it("requires exact rich selection and preserves immutable inputs and authored spaces", () => {
    const doc = document()
    const before = JSON.stringify(doc)
    const all = range(
      doc,
      0,
      selected(doc)
        .map((run) => run.text)
        .join("").length
    )
    assert.throws(() =>
      replaceCvFieldRange(
        doc,
        all,
        richTextOf("  Việt e\u0302 😀  "),
        richTextOf("changed")
      )
    )
    const edited = replaceCvFieldRange(
      doc,
      all,
      selected(doc),
      richTextOf("  Viê\u0323t  ")
    )
    assert.deepEqual(selected(edited.candidate), richTextOf("  Viê\u0323t  "))
    assert.deepEqual(edited.effects[0]?.before, selected(doc))
    assert.equal(JSON.stringify(doc), before)
    assert.deepEqual(
      selected(
        replaceCvFieldRange(doc, all, selected(doc), richTextOf("")).candidate
      ),
      []
    )
  })
  it("supports empty, collapsed, whitespace and combining boundaries without normalization", () => {
    const empty = document("")
    assert.deepEqual(
      selected(
        replaceCvFieldRange(
          empty,
          range(empty, 0, 0),
          richTextOf(""),
          richTextOf(" e\u0302 ")
        ).candidate
      ),
      richTextOf(" e\u0302 ")
    )
    const doc = document("e\u0302")
    const selectedMark = selected(doc).map((run) => ({ ...run, text: "e" }))
    const edited = formatCvFieldRange(
      doc,
      range(doc, 0, 1),
      selectedMark as ReturnType<typeof selected>,
      { bold: null }
    )
    assert.equal(
      selected(edited.candidate)
        .map((run) => run.text)
        .join(""),
      "e\u0302"
    )
    assert.deepEqual(
      formatCvFieldRange(empty, range(empty, 0, 0), richTextOf(""), {
        underline: true,
      }).candidate,
      empty
    )
    assert.throws(() =>
      formatCvFieldRange(empty, range(empty, 0, 0), richTextOf(""), {
        href: "javascript:x",
      } as never)
    )
  })
  it("formats mixed marks and link boundaries while retaining whitespace", () => {
    const doc = document(" x ")
    const whole = range(doc, 0, 3)
    const formatted = formatCvFieldRange(doc, whole, selected(doc), {
      bold: null,
      italic: null,
      href: null,
    })
    assert.deepEqual(selected(formatted.candidate), [
      { text: " x ", underline: true },
    ])
    const collapsed = replaceCvFieldRange(
      formatted.candidate,
      range(doc, 1, 1),
      richTextOf(""),
      richTextOf("e\u0302")
    )
    assert.equal(
      selected(collapsed.candidate)
        .map((run) => run.text)
        .join(""),
      " e\u0302x "
    )
    assert.throws(() =>
      replaceCvFieldRange(doc, whole, selected(doc), richTextOf("bad\nfield"))
    )
  })
  it("refuses invalid offsets and surrogate splits without mutation", () => {
    const doc = document("😀")
    const before = JSON.stringify(doc)
    for (const [from, to] of [
      [1, 1],
      [0, 1],
      [1, 2],
      [-1, 0],
      [0, 3],
      [2, 0],
      [0.5, 1],
      [NaN, 0],
    ])
      assert.throws(() =>
        replaceCvFieldRange(
          doc,
          range(doc, from ?? 0, to ?? 0),
          richTextOf(""),
          richTextOf("x")
        )
      )
    assert.equal(JSON.stringify(doc), before)
  })
})
