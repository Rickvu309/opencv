import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  detectAbortableWrite,
  detectDroppedInput,
} from "./lib/paper-page-writes.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const PAGE = path.join(root, "apps/web/src/features/paper-page")

const droppedMistake = `
export function pastePlain(draft: WritingDraft, span: TextSpan, value: string): WritingDraft {
  const lines = value.split("\\n")
  if (lines.length - 1 > 1) return draft
  return insertText(draft, span, value)
}
`

const droppedClean = `
export function pastePlain(draft: WritingDraft, span: TextSpan, value: string): WritingDraft {
  let next = insertText(draft, span, "")
  for (const line of value.split("\\n")) next = insertText(next, pointSpan(next.caret), line)
  return next
}
export function deleteBackward(draft: WritingDraft, span: TextSpan): WritingDraft {
  if (span.anchor.offset === 0) return draft
  return draft
}
`

const abortableMistake = `
async function sendPage(input: unknown, signal: AbortSignal) {
  return runContractCommand(commandClient(), "paper.canvas", input, {
    refresh: false,
    signal,
  })
}
`

const abortableClean = `
async function sendPage(input: unknown) {
  return runContractCommand(commandClient(), "paper.canvas", input, {
    refresh: false,
  })
}
`

test("MISTAKE: a paste that returns the draft unchanged past a line count fires", () => {
  assert.equal(detectDroppedInput(droppedMistake), true)
})

test("a paste that keeps every line, and a no-op at the page start, stay quiet", () => {
  assert.equal(detectDroppedInput(droppedClean), false)
})

test("MISTAKE: a page write that the next keystroke can abort fires", () => {
  assert.equal(detectAbortableWrite(abortableMistake), true)
})

test("a page write that always finishes stays quiet", () => {
  assert.equal(detectAbortableWrite(abortableClean), false)
})

test("the writing page keeps every pasted line and lets its writes finish", () => {
  const sources = readdirSync(PAGE).filter(
    (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
  )
  assert.ok(sources.length > 0)
  for (const name of sources) {
    const text = readFileSync(path.join(PAGE, name), "utf8")
    assert.equal(detectDroppedInput(text), false, `${name} drops input`)
    assert.equal(detectAbortableWrite(text), false, `${name} aborts a write`)
  }
})
