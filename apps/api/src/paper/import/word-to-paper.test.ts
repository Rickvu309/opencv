import {
  emptyRichPaper,
  richPaperDocumentSchema,
} from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import { compileFlowNativeDocx } from "../native-output/formatted.js"
import { fixturePackage, paragraph } from "./package-fixtures.js"
import {
  PHOTOS_DROPPED,
  TABLES_FLATTENED,
  paperFromLines,
  paperFromWord,
} from "./word-to-paper.js"

type Shape = Record<string, unknown>

function letterWith(children: unknown[], page?: Shape) {
  const blank = emptyRichPaper("letter")
  const section = blank.flow.children[0]!
  const geometry = page ?? blank.presentation.page
  return richPaperDocumentSchema.parse({
    ...blank,
    presentation: { ...blank.presentation, page: geometry },
    flow: {
      ...blank.flow,
      children: [{ ...section, page: geometry, children }],
    },
  })
}

function wordOf(paper: ReturnType<typeof letterWith>) {
  const { version: _version, schemaRevision: _revision, ...flow } = paper
  void _version
  void _revision
  const output = compileFlowNativeDocx({ document: flow })
  if (output.kind !== "ok") throw new Error(output.reason)
  return output.value
}

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
  it("keeps headings, lists, marks, alignment, spacing, tables, page breaks and page size", async () => {
    const page = {
      width: 15840,
      height: 12240,
      orientation: "landscape" as const,
      top: 720,
      bottom: 720,
      start: 1080,
      end: 1080,
    }
    const source = letterWith(
      [
        {
          id: "h",
          type: "heading",
          level: 2,
          paragraph: {},
          content: [{ text: "Experience" }],
        },
        {
          id: "p",
          type: "paragraph",
          paragraph: { alignment: "center", before: 120, after: 240 },
          content: [
            { text: "Led ", bold: true },
            { text: "a team", italic: true, underline: true },
            { text: " of five", color: "#1F4E79", size: 280 },
          ],
        },
        {
          id: "b1",
          type: "bullet",
          paragraph: {},
          content: [{ text: "Shipped the app" }],
          children: [
            {
              id: "b2",
              type: "bullet",
              paragraph: {},
              content: [{ text: "Reached 1,000 users" }],
              children: [],
            },
          ],
        },
        {
          id: "n1",
          type: "numbered",
          paragraph: {},
          content: [{ text: "First step" }],
          children: [],
        },
        { id: "br", type: "pageBreak" },
        {
          id: "t",
          type: "table",
          columns: [
            { id: "c1", width: 3000 },
            { id: "c2", width: 4000 },
          ],
          children: [
            {
              id: "r1",
              type: "row",
              children: [
                {
                  id: "x1",
                  type: "cell",
                  columnId: "c1",
                  children: [
                    {
                      id: "x1p",
                      type: "paragraph",
                      paragraph: {},
                      content: [{ text: "2024" }],
                    },
                  ],
                },
                {
                  id: "x2",
                  type: "cell",
                  columnId: "c2",
                  children: [
                    {
                      id: "x2p",
                      type: "paragraph",
                      paragraph: {},
                      content: [{ text: "OpenCV" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "end",
          type: "paragraph",
          paragraph: {},
          content: [{ text: "Thank you" }],
        },
      ],
      page
    )
    const brought = await paperFromWord(wordOf(source), "letter")
    expect(brought.dropped).toEqual([])
    expect(brought.paper.presentation.page).toEqual(page)
    const back = outline(bodyOf(brought.paper)) as Shape[]
    const expected = outline(bodyOf(source)) as Shape[]
    expect(back.map((node) => node.type)).toEqual(
      expected.map((node) => node.type)
    )
    expect(back[0]).toMatchObject({ type: "heading", level: 2 })
    expect(back[1]).toMatchObject({
      paragraph: { alignment: "center", before: 120, after: 240 },
    })
    expect((back[1]!.content as Shape[]).map((run) => run.text)).toEqual([
      "Led ",
      "a team",
      " of five",
    ])
    expect((back[1]!.content as Shape[])[0]).toMatchObject({ bold: true })
    expect((back[1]!.content as Shape[])[1]).toMatchObject({
      italic: true,
      underline: true,
    })
    expect((back[1]!.content as Shape[])[2]).toMatchObject({
      color: "#1F4E79",
      size: 280,
    })
    expect(back[2]).toMatchObject({
      type: "bullet",
      children: [
        { type: "bullet", content: [{ text: "Reached 1,000 users" }] },
      ],
    })
    expect(back[3]).toMatchObject({ type: "numbered" })
    expect(back[5]).toEqual(expected[5])
    expect(back[6]).toMatchObject({ content: [{ text: "Thank you" }] })
  })

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
