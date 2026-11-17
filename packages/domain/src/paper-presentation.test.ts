import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  inlineSchema,
  paragraphSchema,
  pageSchema,
  parse,
  styleIdSchema,
} from "./paper-doc/presentation-values.js"
import {
  resolveStyles,
  resolveInline,
  resolveParagraph,
} from "./paper-doc/presentation-styles.js"
import {
  validatePresentationPatch,
  checkSnapshot,
} from "./paper-doc/presentation-edit.js"
import {
  effectiveParagraphStyle,
  paragraphInlineValues,
} from "./paper-doc/paragraph-styles.js"

const page = {
  width: 11906,
  height: 16838,
  orientation: "portrait",
  top: 1440,
  bottom: 1440,
  start: 1440,
  end: 1440,
}
const snapshot = () =>
  checkSnapshot({
    document: { codecVersion: 1, page, inline: {}, paragraph: {}, styles: [] },
    blocks: [
      {
        ownerId: "body",
        paragraph: {},
        runs: [{ text: "English Việt 😀", values: {} }],
      },
    ],
  })
function value<T>(
  r: { kind: "ok"; value: T } | { kind: "refused"; reason: string }
): T {
  if (r.kind === "refused") throw new Error(r.reason)
  return r.value
}
describe("private presentation values", () => {
  it("inherits unstyled document defaults while resolving semantic headings", () => {
    for (const style of [undefined, null])
      assert.deepEqual(
        paragraphInlineValues(effectiveParagraphStyle("paragraph", style)),
        {}
      )
    assert.equal(effectiveParagraphStyle("paragraph", "normal"), "normal")
    assert.equal(effectiveParagraphStyle("heading", undefined, 2), "heading-2")
  })
  it("refuses unknown values, unsupported fonts, units and geometry", () => {
    for (const input of [
      { mystery: true },
      { fontId: "invented" },
      { size: 10 },
      { color: "red" },
      { color: "#abcdef" },
    ])
      assert.equal(parse(inlineSchema, input).kind, "refused")
    for (const input of [
      { alignment: "middle" },
      { before: -1 },
      { lineSpacing: { kind: "exact", value: 0 } },
      { indent: { kind: "hanging", value: 2, extra: true } },
    ])
      assert.equal(parse(paragraphSchema, input).kind, "refused")
    for (const value of [0.5, 1, 1.125, 1.15, 1.2, 1.25, 1.5, 2.05, 4.15, 10])
      assert.equal(
        parse(paragraphSchema, { lineSpacing: { kind: "multiple", value } })
          .kind,
        "ok"
      )
    for (const input of [
      { ...page, top: 16838 },
      { ...page, orientation: "landscape" },
      { ...page, width: 0 },
      { ...page, extra: 1 },
    ])
      assert.equal(parse(pageSchema, input).kind, "refused")
    assert.equal(
      parse(paragraphSchema, {
        alignment: "justify",
        lineSpacing: { kind: "atleast", value: 240 },
        indent: { kind: "firstline", value: 360 },
        keepNext: true,
        keepTogether: false,
        widowOrphan: true,
      }).kind,
      "ok"
    )
  })
  it("inherits, clears and overrides styles deterministically", () => {
    const catalog = [
      {
        kind: "character",
        id: "child",
        parent: "base",
        values: { bold: null, italic: true },
      },
      {
        kind: "character",
        id: "base",
        parent: null,
        values: { bold: true, color: "#123456" },
      },
      {
        kind: "paragraph",
        id: "body",
        parent: null,
        values: { alignment: "justify" },
      },
    ]
    const styles = value(resolveStyles(catalog))
    assert.deepEqual(resolveStyles([...catalog].reverse()), {
      kind: "ok",
      value: styles,
    })
    assert.deepEqual(
      value(
        resolveInline(styles, styleIdSchema.parse("child"), { color: null })
      ),
      { italic: true }
    )
    assert.deepEqual(
      value(resolveParagraph(styles, styleIdSchema.parse("body"), {})),
      { alignment: "justify" }
    )
    assert.equal(
      resolveInline(styles, styleIdSchema.parse("body"), {}).kind,
      "refused"
    )
    assert.equal(
      resolveParagraph(styles, styleIdSchema.parse("absent"), {}).kind,
      "refused"
    )
  })
  it("rejects missing, cyclic, duplicate and wrong-kind style parents", () => {
    for (const catalog of [
      [{ kind: "character", id: "a", parent: "missing", values: {} }],
      [{ kind: "character", id: "a", parent: "a", values: {} }],
      [
        { kind: "character", id: "a", parent: null, values: {} },
        { kind: "character", id: "a", parent: null, values: {} },
      ],
      [
        { kind: "character", id: "a", parent: "b", values: {} },
        { kind: "paragraph", id: "b", parent: null, values: {} },
      ],
      [
        {
          kind: "character",
          id: "a",
          parent: null,
          values: { characterStyle: "a" },
        },
      ],
    ])
      assert.equal(resolveStyles(catalog).kind, "refused")
  })
  it("returns exact affected values and rejects CV fields, collapsed and split-surrogate ranges", () => {
    const s = value(snapshot())
    const validated = value(
      validatePresentationPatch(s, {
        kind: "body-inline",
        range: { ownerId: "body", from: 0, to: 7 },
        values: { bold: true, color: "#123456" },
      })
    )
    assert.partialDeepStrictEqual(validated.changes[0], {
      before: { bold: null, color: null },
      after: { bold: true, color: "#123456" },
    })
    for (const patch of [
      { kind: "cv-field", field: "name", values: { bold: true } },
      {
        kind: "body-inline",
        range: { ownerId: "body", from: 0, to: 0 },
        values: { bold: true },
      },
      {
        kind: "body-inline",
        range: { ownerId: "body", from: 0, to: 14 },
        values: { bold: true },
      },
      {
        kind: "body-paragraph",
        ownerId: "missing",
        values: { alignment: "left" },
      },
      { kind: "document-inline", values: { characterStyle: "missing" } },
    ])
      assert.equal(validatePresentationPatch(s, patch).kind, "refused")
    assert.deepEqual(s, value(snapshot()))
  })
})
