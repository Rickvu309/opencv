import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect, detectDocument, message } from "./lib/paper-blank-canvas.mjs"
import { contentOf, mainXml, paragraphsOf } from "./lib/paper-canvas-bytes.mjs"
import { importSource } from "./lib/source-import.mjs"

const blankFile = "packages/domain/src/paper-doc/engine-blank.ts"
const createFile = "apps/api/src/paper/operations/create/server.ts"
const { emptyPaper, blankCv, blankLetter } = await importSource(blankFile)
const { writeDocx } = await importSource(
  "apps/api/src/paper/word/write-docx.ts"
)

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const withBlock = (document, change) => ({
  ...document,
  content: [{ ...document.content[0], ...change(document.content[0]) }],
})

test("every blank kind contains only one empty paragraph", () => {
  for (const kind of ["cv", "letter"]) {
    const clean = emptyPaper(kind)
    assert.deepEqual(detectDocument(clean), [])
    for (const mistake of [
      { ...clean, content: [...clean.content, { ...clean.content[0] }] },
      withBlock(clean, () => ({ content: [{ text: "Pretend name" }] })),
      withBlock(clean, (block) => ({
        attrs: { ...block.attrs, kind: "heading1" },
      })),
      withBlock(clean, (block) => ({
        attrs: { ...block.attrs, align: "center" },
      })),
      withBlock(clean, (block) => ({
        attrs: { ...block.attrs, list: "bullet" },
      })),
      {
        ...clean,
        attrs: {
          ...clean.attrs,
          page: {
            ...clean.attrs.page,
            marginsMpt: { ...clean.attrs.page.marginsMpt, top: 36000 },
          },
        },
      },
    ])
      assert.deepEqual(detectDocument(mistake), [message])
  }
  assert.deepEqual(detectDocument(blankCv()), [])
  assert.deepEqual(detectDocument(blankLetter()), [])
})

test("a blank Letter keeps its one anchor paragraph", () => {
  assert.deepEqual(detectDocument(emptyPaper("letter")), [])
  assert.deepEqual(
    detectDocument(
      withBlock(emptyPaper("letter"), (block) => ({
        attrs: { ...block.attrs, id: "paragraph-1" },
      }))
    ),
    [message]
  )
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
  for (const file of [blankFile, createFile])
    assert.deepEqual(detect(read(file), file), [])
  for (const sha of ["c998b453c", "38eab62e"])
    assert.deepEqual(
      detect(
        execFileSync(
          "git",
          ["show", `${sha}:packages/domain/src/paper-doc/document.ts`],
          { encoding: "utf8" }
        )
      ),
      [message, message]
    )
})

test("a new Paper starts from the engine blank unless it brings lines", () => {
  const create = read(createFile)
  const kept = "return content.length ? { ...blank, content } : blank"
  assert.ok(create.includes(kept))
  assert.deepEqual(
    detect(
      create.replace(
        kept,
        "return { ...blank, content: [...starterSections(), ...content] }"
      ),
      createFile
    ),
    [message]
  )
  assert.deepEqual(
    detect(
      create.replace("paperEngineBlank.blankLetter()", "starterLetter()"),
      createFile
    ),
    [message]
  )
  assert.match(create, /page: startingPage\(input\)/)
  assert.match(
    read("apps/web/src/features/paper/paper-new-dialog.tsx"),
    /"paper\.create", \{\s*kind,\s*format: "rich",\s*\}/
  )
  assert.match(
    read("apps/web/src/features/paper/paper-letter-start.tsx"),
    /"paper\.create", \{\s*kind: "letter",\s*format: "rich",/
  )
})

test("the blank Word download has one empty paragraph, A4 one inch margins and no applied style", () => {
  for (const blank of [blankCv(), blankLetter()]) {
    const bytes = writeDocx(blank, new Map())
    const xml = mainXml(bytes)
    const paragraphs = paragraphsOf(bytes)
    assert.equal(paragraphs.length, 1)
    assert.equal(contentOf(paragraphs[0]), "")
    assert.doesNotMatch(xml, /<w:r\b/)
    assert.deepEqual(
      [...xml.matchAll(/<w:pStyle w:val="([^"]+)"/g)].map((match) => match[1]),
      ["Normal"]
    )
    assert.doesNotMatch(xml, /<(?:w:)?(?:rPr|color|headerReference|numPr)\b/)
    assert.doesNotMatch(xml, /<w:jc w:val="(?!left")/)
    assert.match(xml, /<w:pgSz w:w="11906" w:h="16838"/)
    assert.match(
      xml,
      /<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/
    )
  }
})
