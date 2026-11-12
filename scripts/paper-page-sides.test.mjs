import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  detectInventedHold,
  detectLeanlessCaret,
} from "./lib/paper-page-sides.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const PAGE = path.join(root, "apps/web/src/features/paper-page")

const leanlessMistakeAtC0b0d467 = `
function opsOf(slot: Slot, text: string, at: number | undefined): WordOp[] {
  return [
    {
      op: "setText",
      handle: slot.handle,
      text,
      ...(at === undefined ? {} : { caret: at }),
    },
  ]
}
`

const leanClean = `
function opsOf(slot: Slot, text: string, point: Point | undefined): WordOp[] {
  return [
    {
      op: "setText",
      handle: slot.handle,
      text,
      ...(point === undefined ? {} : { caret: point.at }),
      ...(point?.lean ? { lean: point.lean } : {}),
    },
    { op: "insert", after: slot.handle, text },
  ]
}
`

const inventedHoldAt178f9589 = `
export function pageBlocks(page: WordPage): WritingBlock[] {
  return page.paragraphs.flatMap((paragraph): WritingBlock[] => {
    if (paragraph.held)
      return [{ id: paragraph.handle, text: paragraph.text, held: true }]
    if (hasLineBreak(paragraph)) {
      return [
        {
          id: paragraph.handle,
          text: paragraph.pieces.map((piece) => piece.text).join(""),
          held: true,
          reason: LINE_BREAK_HELD,
        },
      ]
    }
    return [{ id: paragraph.handle, text: paragraph.text }]
  })
}
`

const holdClean = `
export function pageBlocks(page: WordPage): WritingBlock[] {
  return page.paragraphs.flatMap((paragraph): WritingBlock[] => {
    if (paragraph.held)
      return [{ id: paragraph.handle, text: paragraph.text, held: true }]
    return segmentsOf(paragraph).map((segment, index) => ({
      id: \`\${paragraph.handle}#\${index}\`,
      text: segment.text,
      ...(segment.editable ? {} : { held: true }),
    }))
  })
}

export function replaceVisible(blocks: WritingBlock[], current: WritingBlock) {
  if (current?.held) {
    return blocks.map((block) => ({ ...block, held: true as const }))
  }
  return blocks
}
`

test("MISTAKE: a setText op that sends a caret without its side fires", () => {
  assert.deepEqual(
    detectLeanlessCaret(leanlessMistakeAtC0b0d467).map(({ kind, line }) => ({
      kind,
      line,
    })),
    [{ kind: "caret-without-lean", line: 4 }]
  )
})

test("a setText op that sends a caret with its side, and other ops, stay quiet", () => {
  assert.deepEqual(detectLeanlessCaret(leanClean), [])
})

test("MISTAKE: a block held for a reason the page never gave fires", () => {
  assert.deepEqual(
    detectInventedHold(inventedHoldAt178f9589).map(({ kind, line }) => ({
      kind,
      line,
    })),
    [{ kind: "hold-the-page-did-not-ask-for", line: 11 }]
  )
})

test("blocks held only where the page or a piece says so stay quiet", () => {
  assert.deepEqual(detectInventedHold(holdClean), [])
})

test("the writing page names a caret's side and holds only what the page holds", () => {
  const sources = readdirSync(PAGE).filter(
    (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
  )
  assert.ok(sources.length > 0)
  for (const name of sources) {
    const text = readFileSync(path.join(PAGE, name), "utf8")
    assert.deepEqual(detectLeanlessCaret(text, name), [], name)
    assert.deepEqual(detectInventedHold(text, name), [], name)
  }
})
