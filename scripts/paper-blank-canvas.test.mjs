import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { emptyPaper } from "../packages/domain/src/paper-doc/blank-canvas.ts"
import {
  detect,
  detectDocument,
  detectHeaderEdit,
  detectHeaderUndo,
  message,
} from "./lib/paper-blank-canvas.mjs"
import {
  applyCanvasBytes,
  mainXml,
  mintBlankBytes,
  paragraphsOf,
  contentOf,
} from "./lib/paper-canvas-bytes.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("every blank kind contains only one empty paragraph", () => {
  for (const kind of ["cv", "letter"]) {
    const clean = emptyPaper(kind)
    assert.deepEqual(detectDocument(clean), [])
    assert.deepEqual(detectDocument({ ...clean, header: { type: "header" } }), [
      message,
    ])
    assert.deepEqual(
      detectDocument({
        ...clean,
        blocks: [...clean.blocks, { type: "section" }],
      }),
      [message]
    )
    assert.deepEqual(
      detectDocument({
        ...clean,
        blocks: [{ ...clean.blocks[0], style: "Normal" }],
      }),
      [message]
    )
  }
})

test("blank edits retain the Letter anchor and allow an explicitly requested CV header", () => {
  assert.deepEqual(detectDocument(emptyPaper("letter")), [])
  assert.deepEqual(
    detectDocument({
      ...emptyPaper("letter"),
      blocks: [{ id: "paragraph-1", type: "paragraph", content: [] }],
    }),
    [message]
  )
  const clean = read("packages/domain/src/paper-doc/edits.ts")
  assert.deepEqual(detectHeaderEdit(clean), [])
  assert.equal(
    detectHeaderEdit(clean.replace("work.header ??=", "work.header =")).length,
    1
  )
  const historic = execFileSync(
    "git",
    ["show", "999443f9:packages/domain/src/paper-doc/edits.ts"],
    { encoding: "utf8" }
  )
  assert.equal(detectHeaderEdit(historic).length, 1)
  const undo = read("packages/domain/src/paper-doc/undo.ts")
  assert.deepEqual(detectHeaderUndo(undo), [])
  assert.equal(
    detectHeaderUndo(undo.replace("delete work.header", "delete work.missing"))
      .length,
    1
  )
  const oldUndo = execFileSync(
    "git",
    ["show", "999443f9:packages/domain/src/paper-doc/undo.ts"],
    { encoding: "utf8" }
  )
  assert.equal(detectHeaderUndo(oldUndo).length, 1)
  const oldBlank = execFileSync(
    "git",
    ["show", "999443f9:packages/domain/src/paper-doc/blank-canvas.ts"],
    { encoding: "utf8" }
  )
  assert.match(oldBlank, /id: "paragraph-1"/)
  assert.doesNotMatch(oldBlank, /letter-1/)
})

test("blank factories delegate and the historical starter CV fails", () => {
  assert.deepEqual(detect('function blankCv() { return emptyPaper("cv") }'), [])
  assert.deepEqual(detect('function blankCv() { return blankPaper("cv") }'), [])
  assert.deepEqual(
    detect(
      "function blankCv() { return { header: seed(), blocks: sections() } }"
    ),
    [message]
  )
  assert.deepEqual(
    detect(
      'function blankPaper(kind) { return kind === "cv" ? blankCv() : blankLetter() }'
    ),
    []
  )
  assert.deepEqual(
    detect(
      "function blankPaper() { return { header: seed(), blocks: sections() } }"
    ),
    [message]
  )
  for (const file of [
    "packages/domain/src/paper-doc/document.ts",
    "scripts/lib/paper-canvas-mint.mjs",
    "apps/api/src/paper/store.ts",
  ])
    assert.deepEqual(detect(read(file), file), [])
  const introduced = execFileSync(
    "git",
    ["show", "c998b453c:packages/domain/src/paper-doc/document.ts"],
    { encoding: "utf8" }
  )
  assert.deepEqual(detect(introduced), [message, message])
  const historic = execFileSync(
    "git",
    ["show", "38eab62e:packages/domain/src/paper-doc/document.ts"],
    { encoding: "utf8" }
  )
  assert.deepEqual(detect(historic), [message, message])
  assert.match(read("apps/api/src/paper/store.ts"), /blankPaper\(input.kind\)/)
  assert.match(
    read("apps/api/src/paper/package-list.ts"),
    /row\.kind === "cv"\s*\?\s*blankCv\(\)\s*:\s*blankLetter\(\)/
  )
  assert.match(
    read("apps/web/src/features/paper/paper-new-dialog.tsx"),
    /"paper.canvas"/
  )
  assert.match(
    read("apps/web/src/features/paper/paper-letter-start.tsx"),
    /"paper.canvas"/
  )
})

test("the blank Word download has one empty paragraph, default margins and no applied style", () => {
  const bytes = mintBlankBytes()
  const paragraphs = paragraphsOf(bytes)
  assert.equal(paragraphs.length, 1)
  assert.equal(contentOf(paragraphs[0]), "")
  assert.match(mainXml(bytes), /<w:r><w:t><\/w:t><\/w:r>/)
  assert.doesNotMatch(
    mainXml(bytes),
    /<(?:w:)?(?:pStyle|rPr|jc|color|headerReference)\b/
  )
  assert.match(mainXml(bytes), /<w:pgSz w:w="12240" w:h="15840"/)
  assert.match(
    mainXml(bytes),
    /<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/
  )
})

test("the unformatted blank accepts a split without a section carrier paragraph", () => {
  const bytes = mintBlankBytes()
  const result = applyCanvasBytes(
    bytes,
    { op: "split", paragraph: "blank", at: 0 },
    {
      version: 2,
      paragraphs: [{ key: "blank", ordinal: 0, textIds: ["11111112"] }],
    }
  )
  assert.equal(result.status, "APPLIED")
  assert.equal(paragraphsOf(result.bytes).length, 2)
  assert.doesNotMatch(mainXml(result.bytes), /<w:(pStyle|rPr)\b/)
})
