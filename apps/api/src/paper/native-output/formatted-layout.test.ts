import { describe, expect, it } from "vitest"

import { compileLayoutNativeDocx } from "./formatted.js"
import { owner, paragraph, presentation } from "./formatted.test-support.js"
import {
  attribute,
  elements,
  inspect,
  one,
  textOf,
} from "./inspect.test-support.js"

function fixture() {
  return {
    profile: "private-layout-1",
    kind: "letter",
    presentation: {
      ...presentation(),
      inline: { bold: true, fontId: "liberation-serif" },
    },
    flow: {
      id: "flow",
      type: "flow",
      children: [
        paragraph("before", "Before table"),
        {
          id: "table",
          type: "table",
          columns: [
            { id: "a", width: 3000 },
            { id: "b", width: 5000 },
          ],
          children: ["first", "second"].map((id) => ({
            id,
            type: "row",
            children: ["a", "b"].map((columnId) => ({
              id: `${id}-${columnId}`,
              type: "cell",
              columnId,
              children: [
                paragraph(`${id}-${columnId}-text`, `${id} ${columnId}`),
              ],
            })),
          })),
        },
        paragraph("after", "After table"),
      ],
    },
  }
}

function tableOf(document = fixture()) {
  const table = document.flow.children.find((node) => node.type === "table")
  if (!table || !("columns" in table)) throw new Error("Missing test table")
  return table
}

function firstCell(document = fixture()) {
  const cell = tableOf(document).children[0]?.children[0]
  if (!cell) throw new Error("Missing test cell")
  return cell
}

async function output(document: unknown) {
  const result = compileLayoutNativeDocx({ document })
  if (result.kind === "refused") throw new Error(result.reason)
  return inspect(result.value)
}

describe("native layout Word output", () => {
  it("writes editable rectangular cells and exact fixed column widths in flow order", async () => {
    const archive = await output(fixture())
    const part = archive.part("word/document.xml")
    const table = one(part.root, "tbl")
    expect(elements(table, "tr")).toHaveLength(2)
    expect(elements(table, "tc")).toHaveLength(4)
    expect(
      elements(table, "gridCol").map((node) => attribute(node, "w"))
    ).toEqual(["3000", "5000"])
    expect(elements(table, "tcW").map((node) => attribute(node, "w"))).toEqual([
      "3000",
      "5000",
      "3000",
      "5000",
    ])
    expect(attribute(one(table, "tblW"), "w")).toBe("8000")
    expect(attribute(one(table, "tblLayout"), "type")).toBe("fixed")
    expect(textOf(part, part.root)).toBe(
      "Before tablefirst afirst bsecond asecond bAfter table"
    )
    expect(elements(table, "p")).toHaveLength(4)
    expect(elements(table, "drawing")).toHaveLength(0)
    expect(archive.part("docProps/custom.xml").source).toContain(
      "private-layout-1"
    )
  })

  it("keeps rich cell paragraphs, explicit off, Unicode, links and nested lists", async () => {
    const document = fixture()
    const cell = firstCell(document)
    const table = tableOf(document)
    const text = "Việt e\u0302 😀 & <>"
    const rich = {
      id: "rich",
      type: "paragraph",
      paragraph: { alignment: "right", before: 120, after: 240 },
      content: [
        {
          text,
          bold: false,
          italic: true,
          underline: true,
          strike: true,
          fontId: "liberation-sans",
          size: 240,
          color: "#123456",
          href: "https://example.com/vi",
        },
      ],
    }
    const documentWithRichCell = {
      ...document,
      flow: {
        ...document.flow,
        children: document.flow.children.map((node) =>
          node.id === table.id
            ? {
                ...table,
                children: table.children.map((row) => ({
                  ...row,
                  children: row.children.map((item) =>
                    item === cell
                      ? {
                          ...item,
                          children: [
                            rich,
                            {
                              id: "list",
                              type: "bullet",
                              paragraph: {},
                              content: [{ text: "Bullet" }],
                              children: [
                                {
                                  id: "nested",
                                  type: "numbered",
                                  paragraph: {},
                                  content: [{ text: "Nested" }],
                                  children: [],
                                },
                              ],
                            },
                          ],
                        }
                      : item
                  ),
                })),
              }
            : node
        ),
      },
    }
    const archive = await output(documentWithRichCell)
    const part = archive.part("word/document.xml")
    const actual = elements(part.root, "tc")[0]
    if (!actual) throw new Error("Missing emitted cell")
    expect(textOf(part, actual)).toBe(`${text}BulletNested`)
    const run = elements(actual, "r")[0]
    if (!run) throw new Error("Missing rich run")
    expect(attribute(one(run, "b"), "val")).toBe("0")
    expect(attribute(one(run, "i"), "val")).toBe("1")
    expect(attribute(one(run, "rStyle"), "val")).toBe("Hyperlink")
    expect(attribute(one(run, "u"), "val")).toBe("single")
    expect(attribute(one(run, "strike"), "val")).toBe("1")
    expect(attribute(one(run, "rFonts"), "ascii")).toBe("Liberation Sans")
    expect(attribute(one(run, "sz"), "val")).toBe("24")
    expect(elements(run, "color")).toHaveLength(0)
    const hyperlinkStyle = elements(
      archive.part("word/styles.xml").root,
      "style"
    ).find((node) => attribute(node, "styleId") === "Hyperlink")
    if (!hyperlinkStyle) throw new Error("Missing Hyperlink character style")
    expect(attribute(hyperlinkStyle, "type")).toBe("character")
    expect(attribute(one(hyperlinkStyle, "u"), "val")).toBe("single")
    expect(attribute(one(hyperlinkStyle, "color"), "val")).toBe("1D4ED8")
    expect(attribute(one(actual, "jc"), "val")).toBe("right")
    expect(
      elements(actual, "ilvl").map((node) => attribute(node, "val"))
    ).toEqual(["0", "1"])
    expect(archive.part("word/_rels/document.xml.rels").source).toContain(
      "https://example.com/vi"
    )
  })

  it("keeps empty cells as editable paragraphs and accepts table-only Letters", async () => {
    const document = fixture()
    const table = tableOf(document)
    const empty = {
      ...table,
      children: table.children.map((row) => ({
        ...row,
        children: row.children.map((cell) => ({
          ...cell,
          children: [paragraph(`${cell.id}-empty`, "")],
        })),
      })),
    }
    const archive = await output({
      ...document,
      flow: { ...document.flow, children: [empty] },
    })
    const part = archive.part("word/document.xml")
    expect(elements(part.root, "tc")).toHaveLength(4)
    expect(elements(part.root, "p")).toHaveLength(4)
    expect(textOf(part, part.root)).toBe("")
  })

  it("keeps the semantic CV header before a table", async () => {
    const document = fixture()
    const archive = await output({
      ...document,
      kind: "cv",
      flow: {
        ...document.flow,
        children: [owner("header", "contact"), tableOf(document)],
      },
    })
    const part = archive.part("word/document.xml")
    const text = textOf(part, part.root)
    expect(text.indexOf("contact fullName")).toBeLessThan(
      text.indexOf("first a")
    )
  })

  it("refuses invalid geometry and unsupported cell content before producing a package", () => {
    const document = fixture()
    const table = tableOf(document)
    const variants = [
      {
        ...table,
        columns: [
          { id: "a", width: 9000 },
          { id: "b", width: 9000 },
        ],
      },
      {
        ...table,
        children: table.children.map((row) => ({
          ...row,
          children: row.children.slice(0, 1),
        })),
      },
      {
        ...table,
        children: table.children.map((row) => ({
          ...row,
          children: row.children.map((cell) => ({
            ...cell,
            children: [
              { id: "photo", type: "image", src: "https://example.com/image" },
            ],
          })),
        })),
      },
    ]
    for (const invalid of variants)
      expect(
        compileLayoutNativeDocx({
          document: {
            ...document,
            flow: { ...document.flow, children: [invalid] },
          },
        }).kind
      ).toBe("refused")
  })
})
