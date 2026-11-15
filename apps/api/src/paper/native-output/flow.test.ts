import { describe, expect, it } from "vitest"
import {
  flowDocumentSchema,
  flowSectionSchema,
} from "@workspace/domain/internal/paper-presentation"
import { compileFlowNativeDocx } from "./formatted.js"
import { paragraph, presentation, cv } from "./formatted.test-support.js"
import {
  attribute,
  elements,
  inspect,
  one,
  textOf,
} from "./inspect.test-support.js"

function fixture() {
  const appearance = presentation()
  return flowDocumentSchema.parse({
    profile: "private-layout-3",
    kind: "letter",
    presentation: appearance,
    flow: {
      id: "flow",
      type: "flow",
      children: [
        {
          id: "one",
          type: "flowSection",
          start: "continuous",
          page: appearance.page,
          columns: { count: 1, gap: 360 },
          children: [paragraph("intro", "One column Việt")],
        },
        {
          id: "two",
          type: "flowSection",
          start: "next-page",
          page: appearance.page,
          columns: { count: 2, gap: 480 },
          children: [
            paragraph("left", "Two columns"),
            { id: "hard-break", type: "pageBreak" },
            paragraph("after", "After hard break"),
          ],
        },
        {
          id: "three",
          type: "flowSection",
          start: "continuous",
          page: appearance.page,
          columns: { count: 1, gap: 360 },
          children: [paragraph("outro", "One column again")],
        },
      ],
    },
  })
}
function compile(document: unknown) {
  const result = compileFlowNativeDocx({ document })
  if (result.kind === "refused") throw new Error(result.reason)
  return result.value
}
describe("private section flow Word output", () => {
  it("exports section-specific column counts, gaps, starts and exactly one authored page break", async () => {
    const part = (await inspect(compile(fixture()))).part("word/document.xml")
    const sections = elements(part.root, "sectPr")
    expect(sections.map((node) => attribute(one(node, "cols"), "num"))).toEqual(
      ["1", "2", "1"]
    )
    expect(
      sections.map((node) => attribute(one(node, "cols"), "space"))
    ).toEqual(["360", "480", "360"])
    expect(sections.map((node) => attribute(one(node, "type"), "val"))).toEqual(
      ["continuous", "nextPage", "continuous"]
    )
    expect(
      elements(part.root, "br").map((node) => attribute(node, "type"))
    ).toEqual(["page"])
    expect(textOf(part, part.root)).toBe(
      "One column ViệtTwo columns\nAfter hard breakOne column again"
    )
    expect(elements(part.root, "p")).toHaveLength(5)
    expect(elements(part.root, "tbl")).toHaveLength(0)
    expect(elements(part.root, "lastRenderedPageBreak")).toHaveLength(0)
  })
  it("retains independent page geometry and uses a table-safe section boundary", async () => {
    const document = fixture(),
      section = document.flow.children[1]
    if (!section) throw new Error("Missing section")
    document.flow.children[1] = flowSectionSchema.parse({
      ...section,
      page: {
        width: 16838,
        height: 11906,
        orientation: "landscape",
        top: 720,
        bottom: 720,
        start: 720,
        end: 720,
      },
      children: [
        {
          id: "table",
          type: "table",
          columns: [{ id: "a", width: 3000 }],
          children: [
            {
              id: "row",
              type: "row",
              children: [
                {
                  id: "cell",
                  type: "cell",
                  columnId: "a",
                  children: [
                    {
                      id: "cell-text",
                      type: "paragraph",
                      paragraph: {},
                      content: [
                        { text: "Cell keeps text", bold: false, italic: true },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    const final = document.flow.children[2]
    if (!final) throw new Error("Missing final section")
    final.start = "next-page"
    const part = (await inspect(compile(document))).part("word/document.xml")
    const sections = elements(part.root, "sectPr")
    const landscape = sections[1]
    if (!landscape) throw new Error("Missing landscape section")
    expect(attribute(one(landscape, "pgSz"), "orient")).toBe("landscape")
    expect(attribute(one(landscape, "pgSz"), "w")).toBe("16838")
    expect(attribute(one(landscape, "pgMar"), "left")).toBe("720")
    expect(elements(one(part.root, "tbl"), "sectPr")).toHaveLength(0)
    expect(attribute(one(part.root, "tblW"), "w")).toBe("3000")
    const table = one(part.root, "tbl")
    expect(attribute(one(table, "b"), "val")).toBe("0")
    expect(attribute(one(table, "i"), "val")).toBe("1")
    expect(textOf(part, part.root)).toContain("Cell keeps text")
  })
  it("preserves semantic CV fields across sections without exporting private identity metadata as text", async () => {
    const source = cv(),
      base = fixture(),
      first = base.flow.children[0],
      second = base.flow.children[1]
    if (!first || !second) throw new Error("Missing sections")
    const document = flowDocumentSchema.parse({
      ...base,
      kind: "cv",
      flow: {
        ...base.flow,
        children: [
          { ...first, children: [source.header, source.blocks[0]] },
          { ...second, children: source.blocks.slice(1) },
        ],
      },
    })
    const part = (await inspect(compile(document))).part("word/document.xml")
    const text = textOf(part, part.root)
    expect(text).toContain("contact name Việt")
    expect(text).toContain("TypeScript & Vietnamese")
    expect(text).not.toContain("cvField")
  })
  it("refuses invalid flow instead of dropping content", () => {
    const source = fixture()
    expect(
      compileFlowNativeDocx({ document: { ...source, pages: [] } }).kind
    ).toBe("refused")
    const first = source.flow.children[0]
    if (!first) throw new Error("Missing section")
    first.columns = { count: 2, gap: 31680 }
    expect(compileFlowNativeDocx({ document: source }).kind).toBe("refused")
  })
})
