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

const page = {
  width: 11906,
  height: 16838,
  orientation: "portrait",
  top: 1440,
  bottom: 1440,
  start: 1440,
  end: 1440,
}
function value<T>(
  r: { kind: "ok"; value: T } | { kind: "refused"; reason: string }
): T {
  if (r.kind === "refused") throw new Error(r.reason)
  return r.value
}
describe("private presentation values", () => {
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
})
