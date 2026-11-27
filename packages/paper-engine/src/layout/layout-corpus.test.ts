import type { Block, Document } from "@workspace/domain/paper-doc"
import { describe, expect, it } from "vitest"

import { corpusDocument, type CorpusCv } from "./corpus-paper.test-support.js"
import { createLayouter, paperFontMetrics } from "./index.js"
import type { Layout, LineBox } from "./types.js"

const corpus = import.meta.glob<CorpusCv>(
  "../../../paper-corpus/tests/fixtures/cvs/*.expected.json",
  { eager: true, import: "default" }
)
const cvs = Object.entries(corpus as Record<string, CorpusCv>)
  .map(([path, cv]) => ({
    id: path.split("/").at(-1)!.replace(".expected.json", ""),
    cv,
  }))
  .sort((a, b) => a.id.localeCompare(b.id))
const sample = ["en-01", "en-05", "en-10", "vi-01", "vi-05"]

const layOut = (doc: Document) =>
  createLayouter(paperFontMetrics).layout(doc, null)

const linesOf = (layout: Layout) =>
  layout.pages.flatMap((page) =>
    page.boxes
      .filter((box): box is LineBox => box.kind === "line")
      .map((box) => ({ page: page.index, box }))
  )

const textOf = (block: Block) =>
  block.type === "text_block"
    ? (block.content ?? [])
        .map((run) => (run.type === "text" ? run.text : "\n"))
        .join("")
    : ""

describe("real-font pages for the sample CVs", () => {
  it("has the whole corpus to lay out", () => {
    expect(cvs).toHaveLength(20)
  })

  it.each(sample)(
    "%s keeps every glyph of every block, inside the page",
    (id) => {
      const doc = corpusDocument(cvs.find((cv) => cv.id === id)!.cv)
      const layout = layOut(doc)
      const found = linesOf(layout)
      for (const block of doc.content) {
        if (block.type !== "text_block") continue
        const drawn = found
          .filter(({ box }) => box.block === block.attrs.id)
          .flatMap(({ box }) => box.segments.map((segment) => segment.text))
          .join("")
        expect(drawn).toBe(textOf(block).replace(/\t/g, ""))
      }
      for (const page of layout.pages) {
        const right = page.content.x + page.content.w
        for (const box of page.boxes) {
          if (box.kind !== "line") continue
          for (const segment of box.segments) {
            expect(segment.x).toBeGreaterThanOrEqual(page.content.x)
            const face = paperFontMetrics.face(segment.font)
            const inked = [...segment.text.trimEnd()].reduce(
              (sum, char) =>
                sum + face.advance(char.codePointAt(0)!) * segment.sizeMpt,
              0
            )
            expect(segment.x + Math.round(inked / 1000)).toBeLessThanOrEqual(
              right + 100
            )
          }
        }
      }
    }
  )

  it("breaks the sample CVs into the same pages every time", () => {
    const pages = Object.fromEntries(
      sample.map((id) => {
        const layout = layOut(
          corpusDocument(cvs.find((cv) => cv.id === id)!.cv)
        )
        const perPage = layout.pages.map(
          (page) => page.boxes.filter((box) => box.kind === "line").length
        )
        return [id, perPage.join("/")]
      })
    )
    expect(pages).toMatchInlineSnapshot(`
      {
        "en-01": "22",
        "en-05": "14",
        "en-10": "10/10/19",
        "vi-01": "22",
        "vi-05": "14",
      }
    `)
  })

  it("lines up the dates on the right on every sample CV", () => {
    const edges = new Set<number>()
    let dated = 0
    for (const { cv } of cvs) {
      const doc = corpusDocument(cv)
      const layout = layOut(doc)
      for (const block of doc.content) {
        if (
          block.type !== "text_block" ||
          block.attrs.rightTabMpt === undefined
        )
          continue
        const first = linesOf(layout).find(
          ({ box }) => box.block === block.attrs.id
        )!.box
        const date = first.segments.at(-1)!
        expect(textOf(block).endsWith(date.text)).toBe(true)
        edges.add(
          date.x +
            date.w -
            doc.attrs.page.marginsMpt.left -
            block.attrs.rightTabMpt
        )
        dated += 1
      }
    }
    expect(dated).toBe(17)
    expect([...edges].every((edge) => Math.abs(edge) <= 1)).toBe(true)
  })

  it("never leaves a heading alone at the bottom of a page in any sample CV", () => {
    for (const { cv } of cvs) {
      const doc = corpusDocument(cv)
      const layout = layOut(doc)
      doc.content.forEach((block, index) => {
        const next = doc.content[index + 1]
        if (block.type !== "text_block" || !next || next.type === "page_break")
          return
        if (block.attrs.kind !== "heading" && block.attrs.kind !== "subheading")
          return
        const own = layout.blockPages[block.attrs.id]!
        const after = layout.blockPages[next.attrs.id]!
        expect(own.at(-1)).toBe(after[0])
      })
    }
  })

  it("gives byte-identical layout JSON for the same Paper twice", () => {
    for (const id of sample) {
      const doc = corpusDocument(cvs.find((cv) => cv.id === id)!.cv)
      const again = corpusDocument(cvs.find((cv) => cv.id === id)!.cv)
      expect(JSON.stringify(layOut(again))).toBe(JSON.stringify(layOut(doc)))
    }
  })
})
