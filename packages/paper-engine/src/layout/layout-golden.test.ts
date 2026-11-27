import type { Block, BlockId, Document, Pos } from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import {
  caret,
  createLayouter,
  fixedMetrics,
  lineEdges,
  locate,
} from "./index.js"
import type { Layout, LineBox } from "./types.js"

const metrics = fixedMetrics()
const LEFT = 72000
const WIDTH = 110000
const CHAR = 5500
const LINE = 11000

type Extra = Partial<{
  list: "bullet" | "numbered"
  level: number
  rightTabMpt: number
  keepWithNext: boolean
  align: "left" | "center" | "right" | "justify"
}>

function text(
  id: string,
  kind: string,
  value: string,
  extra: Extra = {}
): Block {
  return {
    type: "text_block",
    attrs: {
      id: id as BlockId,
      kind: kind as "paragraph",
      list: extra.list ?? null,
      level: (extra.level ?? 0) as 0,
      align: extra.align ?? "left",
      lineSpacing: null,
      keepWithNext: extra.keepWithNext ?? null,
      ...(extra.rightTabMpt ? { rightTabMpt: extra.rightTabMpt } : {}),
    },
    ...(value ? { content: [{ type: "text", text: value }] } : {}),
  } as Block
}

function paper(content: Block[]): Document {
  return {
    type: "doc",
    attrs: {
      schema: 1,
      template: "classic",
      page: {
        size: "A4",
        orientation: "portrait",
        marginsMpt: {
          top: 72000,
          right: 595276 - LEFT - WIDTH,
          bottom: 72000,
          left: LEFT,
        },
      },
    },
    content,
  }
}

const lay = (content: Block[]) =>
  createLayouter(metrics).layout(paper(content), null)

const lines = (layout: Layout) =>
  layout.pages.flatMap((page) =>
    page.boxes
      .filter((box): box is LineBox => box.kind === "line")
      .map((box) => ({ page: page.index, box }))
  )

const pageOf = (layout: Layout, id: string) => layout.blockPages[id]!

const fillers = (count: number) =>
  Array.from({ length: count }, (_, n) =>
    text(`f${n}`, "paragraph", `filler ${n}`)
  )

describe("golden pages with every glyph 500 units wide", () => {
  it("draws an A4 page in integer millipoints", () => {
    const layout = lay([text("a", "paragraph", "hello")])
    const page = layout.pages[0]!
    expect(page.size).toEqual({ w: 595276, h: 841890 })
    expect(page.content).toEqual({ x: LEFT, y: 72000, w: WIDTH, h: 697890 })
    const json = JSON.stringify(layout)
    expect(json).not.toMatch(/\d\.\d/)
  })

  it("breaks lines at spaces, after hyphens, and inside a word only when it must", () => {
    const words = lines(
      lay([text("a", "paragraph", "aaaa bbbb cccc dddd eeee ffff")])
    )
    expect(words.map(({ box }) => [box.from, box.to, box.rect.y])).toEqual([
      [0, 20, 72000],
      [20, 29, 72000 + LINE],
    ])
    expect(words[0]!.box.segments).toEqual([
      expect.objectContaining({
        x: LEFT,
        w: 20 * CHAR,
        text: "aaaa bbbb cccc dddd ",
        font: "liberation-sans-regular",
        sizeMpt: 11000,
      }),
    ])
    const hyphen = lines(
      lay([text("a", "paragraph", "abcdefghij-klmnopqrstuvwxyz")])
    )
    expect(hyphen.map(({ box }) => box.segments[0]!.text)).toEqual([
      "abcdefghij-",
      "klmnopqrstuvwxyz",
    ])
    const long = lines(lay([text("a", "paragraph", "x".repeat(25))]))
    expect(long.map(({ box }) => [box.from, box.to])).toEqual([
      [0, 20],
      [20, 25],
    ])
  })

  it("puts the dates after the tab against the right tab stop", () => {
    const layout = lay([
      text("a", "subheading", "Role\t2022 - 2024", { rightTabMpt: WIDTH }),
      text("b", "subheading", "A long role\t2021", { rightTabMpt: WIDTH }),
    ])
    const [first, second] = lines(layout).map(({ box }) => box.segments)
    expect(
      first!.map((segment) => [segment.text, segment.x, segment.x + segment.w])
    ).toEqual([
      ["Role", LEFT, LEFT + 4 * CHAR],
      ["2022 - 2024", LEFT + WIDTH - 11 * CHAR, LEFT + WIDTH],
    ])
    expect(second!.at(-1)!.x + second!.at(-1)!.w).toBe(LEFT + WIDTH)
    expect(second!.at(-1)!.font).toBe("liberation-sans-bold")
  })

  it("hangs list markers and numbers each level", () => {
    const layout = lay([
      text("a", "paragraph", "one", { list: "numbered" }),
      text("b", "paragraph", "one a", { list: "numbered", level: 1 }),
      text("c", "paragraph", "two", { list: "numbered" }),
      text("d", "paragraph", "dot", { list: "bullet" }),
      text("e", "paragraph", "plain"),
      text("f", "paragraph", "again", { list: "numbered" }),
    ])
    const found = lines(layout).map(({ box }) => [
      box.marker?.text ?? null,
      box.marker?.x ?? null,
      box.segments[0]!.x,
    ])
    expect(found).toEqual([
      ["1.", LEFT, LEFT + 18000],
      ["a.", LEFT + 18000, LEFT + 36000],
      ["2.", LEFT, LEFT + 18000],
      ["•", LEFT, LEFT + 18000],
      [null, null, LEFT],
      ["1.", LEFT, LEFT + 18000],
    ])
  })

  it("never leaves a heading alone at the bottom of a page", () => {
    for (let count = 40; count <= 52; count += 1) {
      const layout = lay([
        ...fillers(count),
        text("h", "heading", "Experience"),
        text("s", "subheading", "Role\t2024", { rightTabMpt: WIDTH }),
        text("p", "paragraph", "Did the work."),
      ])
      expect(pageOf(layout, "h")).toEqual(pageOf(layout, "p"))
      expect(pageOf(layout, "s")).toEqual(pageOf(layout, "p"))
    }
  })

  it("keeps at least two lines of a paragraph on each side of a page break", () => {
    const long = "word ".repeat(4 * 6).trim()
    let splits = 0
    for (let count = 40; count <= 52; count += 1) {
      const layout = lay([...fillers(count), text("p", "paragraph", long)])
      const found = lines(layout).filter(({ box }) => box.block === "p")
      expect(found).toHaveLength(6)
      const perPage = new Map<number, number>()
      for (const { page } of found)
        perPage.set(page, (perPage.get(page) ?? 0) + 1)
      if (perPage.size > 1) splits += 1
      for (const lineCount of perPage.values())
        expect(lineCount).toBeGreaterThanOrEqual(2)
    }
    expect(splits).toBeGreaterThan(0)
  })

  it("starts a new page after a page break block", () => {
    const layout = lay([
      text("a", "paragraph", "before"),
      { type: "page_break", attrs: { id: "pb" as BlockId } },
      text("b", "paragraph", "after"),
    ])
    expect(layout.pages).toHaveLength(2)
    expect(layout.pages[0]!.boxes.map((box) => box.kind)).toEqual([
      "line",
      "break",
    ])
    expect(pageOf(layout, "b")).toEqual([1])
    expect(layout.pages[1]!.boxes[0]!.rect.y).toBe(72000)
  })

  it("lays table rows whole, and moves a row that does not fit to the next page", () => {
    const table: Block = {
      type: "table",
      attrs: { id: "t" as BlockId, columnsMpt: [55000, 55000], borders: "all" },
      content: Array.from({ length: 30 }, (_, row) => ({
        type: "table_row",
        content: [
          { type: "table_cell", content: [{ type: "text", text: `r${row}` }] },
          {
            type: "table_cell",
            content: [{ type: "text", text: "two words" }],
          },
        ],
      })),
    } as Block
    const layout = lay([...fillers(35), table])
    const cells = layout.pages.flatMap((page) =>
      page.boxes.flatMap((box) =>
        box.kind === "cell" ? [{ page: page.index, box }] : []
      )
    )
    expect(cells).toHaveLength(60)
    expect(cells[0]!.box.rect).toEqual(
      expect.objectContaining({ x: LEFT, w: 55000, h: 2 * LINE + 6000 })
    )
    for (let row = 0; row < 30; row += 1) {
      const pair = cells.filter(
        ({ box }) => box.kind === "cell" && box.row === row
      )
      expect(new Set(pair.map(({ page }) => page)).size).toBe(1)
    }
    expect(pageOf(layout, "t")).toEqual([0, 1])
    const cellLine = lines(layout).find(
      ({ box }) => box.cell?.row === 0 && box.cell.col === 1
    )!
    expect(cellLine.box.segments[0]!.x).toBe(LEFT + 55000 + 5000)
  })

  it("scales a wide image to the content width", () => {
    const image: Block = {
      type: "image",
      attrs: {
        id: "i" as BlockId,
        fileId: "00000000-0000-4000-8000-000000000001" as never,
        widthMpt: 220000,
        heightMpt: 110000,
        align: "left",
        alt: "",
      },
    } as Block
    const layout = lay([image])
    expect(layout.pages[0]!.boxes[0]).toEqual({
      kind: "image",
      block: "i",
      rect: { x: LEFT, y: 72000, w: WIDTH, h: 55000 },
      fileId: "00000000-0000-4000-8000-000000000001",
    })
  })

  it("draws the same golden page for a small CV", () => {
    const layout = lay([
      text("t", "title", "Ada"),
      text("h", "heading", "Work"),
      text("s", "subheading", "Analyst\t2024", { rightTabMpt: WIDTH }),
      text("p", "paragraph", "Built the engine.", { list: "bullet" }),
    ])
    const compact = lines(layout).map(({ box }) =>
      [
        box.block,
        box.rect.y,
        box.rect.h,
        box.baseline,
        box.marker?.text ?? "",
        ...box.segments.map((s) => `${s.x}+${s.w}:${s.text}`),
      ].join(" ")
    )
    expect(compact).toMatchInlineSnapshot(`
      [
        "t 72000 21000 88800  72000+31500:Ada",
        "h 105000 13000 115400  72000+26000:Work",
        "s 125000 11000 133800  72000+38500:Analyst 160000+22000:2024",
        "p 137000 11000 145800 • 90000+55000:Built the ",
        "p 148000 11000 156800  90000+38500:engine.",
      ]
    `)
  })
})

describe("locate, caret and line edges", () => {
  const layout = lay([
    text("a", "paragraph", "aaaa bbbb cccc dddd eeee ffff"),
    text("b", "paragraph", ""),
  ])
  const at = (block: string, offset: number): Pos => ({
    block: block as BlockId,
    offset,
  })

  it("puts the caret after the third glyph", () => {
    expect(caret(metrics, layout, at("a", 3))).toEqual({
      page: 0,
      x: LEFT + 3 * CHAR,
      y: 72000,
      w: 0,
      h: LINE,
    })
  })

  it("shows a caret at a soft wrap at the start of the next line", () => {
    expect(caret(metrics, layout, at("a", 20))).toEqual(
      expect.objectContaining({ x: LEFT, y: 72000 + LINE })
    )
  })

  it("finds the offset under a point, and the nearest line beside it", () => {
    expect(
      locate(metrics, layout, {
        page: 0,
        x: LEFT + 3 * CHAR + 100,
        y: 72000 + 10,
      })
    ).toEqual(at("a", 3))
    expect(
      locate(metrics, layout, {
        page: 0,
        x: LEFT + 2 * CHAR + 2800,
        y: 72000 + LINE + 5,
      })
    ).toEqual(at("a", 23))
    expect(
      locate(metrics, layout, { page: 0, x: LEFT + WIDTH + 9000, y: 72000 })
    ).toEqual(at("a", 19))
    expect(locate(metrics, layout, { page: 0, x: LEFT, y: 800000 })).toEqual(
      at("b", 0)
    )
  })

  it("gives the start and end of the line that holds a position", () => {
    expect(lineEdges(layout, at("a", 5))).toEqual({
      start: at("a", 0),
      end: at("a", 19),
    })
    expect(lineEdges(layout, at("a", 25))).toEqual({
      start: at("a", 20),
      end: at("a", 29),
    })
  })
})
