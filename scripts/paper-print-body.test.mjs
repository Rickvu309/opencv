import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import test from "node:test"

import { detect } from "./lib/paper-print-body.mjs"
import { pathAtRevision } from "./lib/path-at-revision.mjs"

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("Word cards cannot fall back to a missing block body", () => {
  const mistake = `<PaperLibraryCard lines={librarySheetLines(doc)} />`
  const clean = `<PaperLibraryCard lines={librarySheetLines(doc)} preview={doc.format === "word" ? <PaperWordPreview docId={doc.id} /> : undefined} />`
  assert.equal(detect(mistake)[0]?.kind, "word-card-without-first-page-preview")
  assert.deepEqual(detect(clean), [])
  const path = "apps/web/src/features/paper/paper-library-sections.tsx"
  const historic = execFileSync(
    "git",
    ["show", `92613ff1:${pathAtRevision("92613ff1", path)}`],
    {
      encoding: "utf8",
    }
  )
  assert.ok(
    detect(historic, path).some(
      ({ kind }) => kind === "word-card-without-first-page-preview"
    )
  )
  assert.deepEqual(detect(read(path), path), [])
})

test("a Word page is never offered Download PDF over a stand-in body", () => {
  const listedMistake = `function packagePaper(row) { return paperViewSchema.parse({ id: row.docId, kind: row.kind, paper: row.kind === "cv" ? blankCv() : blankLetter() }) }`
  const listedClean = `function packagePaper(row) { return paperViewSchema.parse({ id: row.docId, kind: row.kind, paper: row.kind === "cv" ? blankCv() : blankLetter(), format: "word" }) }`
  const storedClean = `function toPaper(row, paper) { return paperViewSchema.parse({ id: row.id, paper }) }`
  assert.deepEqual(
    detect(listedMistake).map(({ kind }) => kind),
    ["word-page-listed-with-print-body"]
  )
  assert.deepEqual(detect(listedClean), [])
  assert.deepEqual(detect(storedClean), [])

  const menuMistake = `function paperActions(doc, on) { return [{ label: "Open" }, ...each("Download PDF", on.onDownload)] }`
  const menuClean = `function paperActions(doc, on) { return [{ label: "Open" }, ...(hasPrintBody(doc) ? each("Download PDF", on.onDownload) : [])] }`
  assert.deepEqual(
    detect(menuMistake).map(({ kind }) => kind),
    ["download-pdf-without-print-body"]
  )
  assert.deepEqual(detect(menuClean), [])
  assert.deepEqual(
    detect(
      `const Menu = ({ onDownload }) => <DropdownMenuItem onClick={onDownload}>Download PDF</DropdownMenuItem>`
    ).map(({ kind }) => kind),
    ["download-pdf-without-print-body"]
  )
  assert.deepEqual(
    detect(
      `const Menu = ({ doc, onDownload }) => hasPrintBody(doc) && <DropdownMenuItem onClick={onDownload}>Download PDF</DropdownMenuItem>`
    ),
    []
  )

  const list = read("apps/api/src/paper/word-package/package-list.ts")
  const sections = read(
    "apps/web/src/features/paper/paper-library-sections.tsx"
  )
  assert.deepEqual(detect(list, "package-list.ts"), [])
  assert.deepEqual(detect(sections, "paper-library-sections.tsx"), [])
  assert.ok(
    detect(list.replace(`format: "word",`, ""), "package-list.ts").length
  )
  assert.ok(
    detect(
      sections.replace(/hasPrintBody\(doc\) \?/, "true ?"),
      "paper-library-sections.tsx"
    ).length
  )
})
