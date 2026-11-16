import { expect, it } from "vitest"
import { Schema } from "@tiptap/pm/model"
import { paperSearchMatches } from "./editor-search.js"

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "(text|image)*" },
    text: { inline: true },
    image: { inline: true, group: "inline" },
  },
  marks: { bold: {} },
})

it("maps canonical Vietnamese, decomposed accents and emoji to original UTF-16 ranges across marks", () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [
      schema.text("😀 Vie"),
      schema.text("\u0323\u0302t e\u0302 Việt", [schema.mark("bold")]),
    ]),
  ])
  const matches = paperSearchMatches(doc, "VIỆT", false)
  expect(matches.map(({ from, to }) => doc.textBetween(from, to))).toEqual([
    "Vie\u0323\u0302t",
    "Việt",
  ])
  expect(matches[0]?.from).toBe(4)
  expect(
    paperSearchMatches(doc, "ê", false).map(({ from, to }) =>
      doc.textBetween(from, to)
    )
  ).toEqual(["e\u0302"])
  expect(paperSearchMatches(doc, "VIỆT", true)).toEqual([])
  expect(paperSearchMatches(doc, "Viet", false)).toEqual([])
  expect(paperSearchMatches(doc, "", false)).toEqual([])
})

it("does not span a block boundary, an inline object or part of a grapheme", () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [
      schema.text("ab"),
      schema.node("image"),
      schema.text("cd İ"),
    ]),
    schema.node("paragraph", null, [schema.text("ef ababa")]),
  ])
  expect(paperSearchMatches(doc, "abcd", false)).toEqual([])
  expect(paperSearchMatches(doc, "İef", false)).toEqual([])
  expect(paperSearchMatches(doc, "i", false)).toEqual([])
  expect(paperSearchMatches(doc, "aba", false)).toHaveLength(1)
})
