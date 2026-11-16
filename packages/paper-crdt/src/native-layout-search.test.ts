import { expect, it, vi } from "vitest"
import { Schema } from "@tiptap/pm/model"
import { paperSearchMatches } from "./native-layout-search.js"

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

it("folds Greek final sigma on both sides of the same grapheme index", () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [
      schema.text("ΟΣ ος οσ ΟΣΑ Vie\u0323\u0302t"),
    ]),
  ])
  for (const query of ["ΟΣ", "ος", "οσ"])
    expect(
      paperSearchMatches(doc, query, false).map(({ from, to }) =>
        doc.textBetween(from, to)
      )
    ).toEqual(["ΟΣ", "ος", "οσ", "ΟΣ"])
  expect(paperSearchMatches(doc, "ΟΣ", true)).toHaveLength(2)
  expect(
    paperSearchMatches(doc, "VIỆT", false).map(({ from, to }) =>
      doc.textBetween(from, to)
    )
  ).toEqual(["Vie\u0323\u0302t"])
})

it("reuses the normalized index of unchanged blocks after an edit", () => {
  const unchanged = schema.node("paragraph", null, [
    schema.text("Việt unchanged"),
  ])
  const doc = schema.node("doc", null, [
    unchanged,
    schema.node("paragraph", null, [schema.text("Việt edited")]),
  ])
  paperSearchMatches(doc, "việt", false)
  const segment = vi.spyOn(Intl.Segmenter.prototype, "segment")
  try {
    const next = schema.node("doc", null, [
      unchanged,
      schema.node("paragraph", null, [schema.text("Việt edited x")]),
    ])
    expect(paperSearchMatches(next, "VIỆT", false)).toHaveLength(2)
    expect(segment.mock.calls.map(([text]) => text)).not.toContain(
      "Việt unchanged"
    )
    expect(segment.mock.calls.map(([text]) => text)).toContain("Việt edited x")
  } finally {
    segment.mockRestore()
  }
})
