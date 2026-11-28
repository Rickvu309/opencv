import { describe, expect, it } from "vitest"

import { fixturePackage, paragraph } from "./package-fixtures.js"
import {
  PHOTOS_DROPPED,
  TABLES_FLATTENED,
  paperFromLines,
  paperFromWord,
} from "./word-to-paper.js"

type Shape = Record<string, unknown>

function outline(nodes: unknown[]): unknown[] {
  return (nodes as Shape[]).map((node) => {
    if (node.type === "pageBreak") return { type: "pageBreak" }
    if (node.type === "table")
      return {
        type: "table",
        rows: (node.children as Shape[]).map((row) =>
          (row.children as Shape[]).map((cell) =>
            outline(cell.children as unknown[])
          )
        ),
      }
    const { id: _id, children, ...rest } = node
    void _id
    return {
      ...rest,
      ...(Array.isArray(children) && children.length
        ? { children: outline(children) }
        : {}),
    }
  })
}

function bodyOf(paper: { flow: { children: { children: unknown[] }[] } }) {
  return paper.flow.children.flatMap((section) => section.children)
}

describe("a Word file brought in becomes a Paper", () => {
  it("opens a CV with the blank contact header above what was brought in", async () => {
    const brought = await paperFromWord(
      fixturePackage(paragraph("Ada Lovelace")),
      "cv"
    )
    const body = bodyOf(brought.paper) as Shape[]
    expect(body[0]).toMatchObject({ type: "header" })
    expect(body[1]).toMatchObject({ content: [{ text: "Ada Lovelace" }] })
  })

  it("names photos it could not bring in", async () => {
    const brought = await paperFromWord(
      fixturePackage(
        `<w:p><w:r><w:drawing/></w:r><w:r><w:t>Portrait</w:t></w:r></w:p>`
      ),
      "letter"
    )
    expect(brought.dropped).toEqual([PHOTOS_DROPPED])
    expect(bodyOf(brought.paper)).toMatchObject([
      { content: [{ text: "Portrait" }] },
    ])
  })

  it("turns a table with merged cells into its paragraphs", async () => {
    const cell = (text: string, props = "") =>
      `<w:tc>${props}<w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`
    const brought = await paperFromWord(
      fixturePackage(
        `<w:tbl><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid><w:tr>${cell("Both", '<w:tcPr><w:gridSpan w:val="2"/></w:tcPr>')}</w:tr><w:tr>${cell("Left")}${cell("Right")}</w:tr></w:tbl>`
      ),
      "letter"
    )
    expect(brought.dropped).toEqual([TABLES_FLATTENED])
    expect(
      (bodyOf(brought.paper) as Shape[]).map(
        (node) => (node.content as Shape[])[0]?.text
      )
    ).toEqual(["Both", "Left", "Right"])
  })

  it("refuses bytes that are not a Word file", async () => {
    await expect(
      paperFromWord(new TextEncoder().encode("not a zip"), "cv")
    ).rejects.toThrow()
  })

  it("makes a PDF or text file's lines into headings, bullets and paragraphs", () => {
    const paper = paperFromLines("letter", [
      { style: "Title", text: "Ada Lovelace", center: true },
      { style: "Heading1", text: "Experience" },
      { style: "ListBullet", text: "Wrote the first program" },
      { style: "Normal", text: "London" },
    ])
    expect(outline(bodyOf(paper))).toEqual([
      {
        type: "heading",
        level: 2,
        paragraph: { after: 60, alignment: "center" },
        content: [{ text: "Ada Lovelace", bold: true, size: 400 }],
      },
      {
        type: "heading",
        level: 2,
        paragraph: { keepNext: true, before: 240, after: 80 },
        content: [{ text: "Experience", bold: true, size: 260 }],
      },
      {
        type: "bullet",
        paragraph: {},
        content: [{ text: "Wrote the first program" }],
      },
      { type: "paragraph", paragraph: {}, content: [{ text: "London" }] },
    ])
  })
})
