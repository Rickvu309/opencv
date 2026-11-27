import type { BlockId, DocCommand, Document } from "@workspace/domain/paper-doc"
import cv from "@workspace/paper-corpus/tests/fixtures/cvs/en-10.expected.json" with { type: "json" }
import { describe, expect, it } from "vitest"

import { newEngine, person } from "../engine.test-support.js"
import type { EditorState } from "../engine.js"
import { corpusDocument, type CorpusCv } from "./corpus-paper.test-support.js"
import { createLayouter, layoutWork, paperFontMetrics } from "./index.js"
import type { Layout } from "./types.js"

const engine = newEngine()
const span = (block: string, from: number, to = from) => ({
  from: { block: block as BlockId, offset: from },
  to: { block: block as BlockId, offset: to },
})

function session() {
  const layouter = createLayouter(paperFontMetrics)
  let state: EditorState = engine.load(
    corpusDocument(cv as CorpusCv),
    0,
    "tab-1"
  )
  let layout: Layout = layouter.layout(engine.read(state).doc, null)
  return {
    doc: () => engine.read(state).doc,
    layout: () => layout,
    apply(commands: DocCommand[]) {
      const ran = engine.run(state, commands, person)
      if ("refusal" in ran) throw new Error(JSON.stringify(ran.refusal))
      state = ran.state
      layout = layouter.layout(engine.read(state).doc, layout)
      return layoutWork(layout)
    },
  }
}

const fresh = (doc: Document) =>
  JSON.stringify(createLayouter(paperFontMetrics).layout(doc, null))

const textLength = (doc: Document, id: string) => {
  const block = doc.content.find((each) => each.attrs.id === id)!
  return block.type === "text_block"
    ? (block.content ?? []).reduce(
        (sum, run) => sum + (run.type === "text" ? run.text.length : 1),
        0
      )
    : 0
}

describe("a keystroke re-lays only the Block it changed", () => {
  it("lays the 3-page sample CV on three pages", () => {
    expect(session().layout().pages).toHaveLength(3)
  })

  it.each([0, 1, 2])(
    "re-breaks at most 2 Blocks per keystroke while typing on page %i",
    (page) => {
      const run = session()
      const target = run
        .doc()
        .content.find(
          (block) =>
            block.type === "text_block" &&
            block.attrs.kind === "paragraph" &&
            run.layout().blockPages[block.attrs.id]?.join() === String(page)
        )!.attrs.id
      const counts: number[] = []
      for (const char of "and kept a review log for every disputed label") {
        const offset = textLength(run.doc(), target)
        const work = run.apply([
          { op: "insertText", range: span(target, offset), text: char },
        ])
        counts.push(work.blocksLaidOut)
      }
      expect(counts.every((count) => count === 1)).toBe(true)
      expect(JSON.stringify(run.layout())).toBe(fresh(run.doc()))
    }
  )

  it("matches a fresh layout after Enter, Backspace across Blocks and typing on every page", () => {
    const run = session()
    const steps: DocCommand[][] = [
      [{ op: "splitBlock", at: span("b15", 10).from }],
      [{ op: "insertText", range: span("b1", 0), text: "Dr " }],
      [
        {
          op: "deleteRange",
          range: { from: span("b21", 3).from, to: span("b22", 5).to },
        },
      ],
      [
        {
          op: "insertText",
          range: span("b30", 0),
          text: "A much longer opening line that wraps the paragraph further down the page. ",
        },
      ],
      [
        {
          op: "deleteRange",
          range: { from: span("b5", 0).from, to: span("b9", 0).to },
        },
      ],
    ]
    for (const commands of steps) {
      const work = run.apply(commands)
      expect(work.blocksLaidOut).toBeLessThanOrEqual(2)
      expect(JSON.stringify(run.layout())).toBe(fresh(run.doc()))
    }
  })
})
