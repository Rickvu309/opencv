import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formattedDocumentSchema,
  formatRunsSchema,
} from "./paper-doc/native-formatting.js"
const presentation = {
  codecVersion: 1,
  page: {
    width: 11906,
    height: 16838,
    orientation: "portrait",
    top: 1440,
    bottom: 1440,
    start: 1440,
    end: 1440,
  },
  inline: { fontId: "liberation-serif", bold: true },
  paragraph: {},
  styles: [],
}
const letter = () => ({
  profile: "private-formatting-1",
  kind: "letter",
  presentation,
  blocks: [
    {
      id: "body",
      type: "paragraph",
      paragraph: {},
      content: [
        { text: "Việt e\u0302 😀", bold: false, href: "https://example.com/a" },
      ],
    },
  ],
})
describe("private complete formatting contract", () => {
  it("preserves explicit off and exact codepoints while merging only identical complete marks", () => {
    const doc = formattedDocumentSchema.parse(letter())
    assert.partialDeepStrictEqual(doc.blocks[0], {
      content: [{ text: "Việt e\u0302 😀", bold: false }],
    })
    assert.equal(
      formatRunsSchema.safeParse([
        { text: "e\u0302", bold: false },
        { text: "ê", bold: true },
      ]).success,
      true
    )
    const input = letter()
    input.blocks[0]!.content.push({
      text: "Việt e\u0302 😀",
      bold: false,
      href: "https://example.com/a",
    })
    assert.partialDeepStrictEqual(
      formattedDocumentSchema.parse(input).blocks[0],
      { content: [{ text: "Việt e\u0302 😀Việt e\u0302 😀" }] }
    )
  })
  it("refuses unknown owners, nested fields, unsafe links, invalid marks and malformed code units", () => {
    for (const patch of [
      { profile: "revision2" },
      { extra: true },
      {
        blocks: [
          {
            id: "body",
            type: "paragraph",
            paragraph: { alignment: "middle" },
            content: [],
          },
        ],
      },
      {
        blocks: [
          {
            id: "body",
            type: "paragraph",
            paragraph: {},
            content: [{ text: "x", bold: "off" }],
          },
        ],
      },
      {
        blocks: [
          {
            id: "body",
            type: "paragraph",
            paragraph: {},
            content: [{ text: "x", href: "javascript:alert(1)" }],
          },
        ],
      },
      {
        blocks: [
          {
            id: "body",
            type: "paragraph",
            paragraph: {},
            content: [{ text: "\uD800" }],
          },
        ],
      },
      {
        blocks: [
          {
            id: "body",
            type: "paragraph",
            paragraph: {},
            content: [{ text: "x", fontId: "arial" }],
          },
        ],
      },
      {
        blocks: [
          {
            id: "body",
            type: "paragraph",
            paragraph: {},
            content: [{ text: "x", characterStyle: "absent" }],
          },
        ],
      },
    ])
      assert.equal(
        formattedDocumentSchema.safeParse({ ...letter(), ...patch }).success,
        false
      )
    assert.equal(
      formattedDocumentSchema.safeParse({
        ...letter(),
        blocks: [...letter().blocks, ...letter().blocks],
      }).success,
      false
    )
  })
})
