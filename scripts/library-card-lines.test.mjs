import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect, message } from "./lib/library-card-lines.mjs"

const FILE = "apps/web/src/features/paper/paper-library-sections.tsx"

const mistake = `export function librarySheetLines(doc: PaperView): string[] {
  const paper = doc.paper
  if (!paper) return []
  return paperPlainText(paper).split("\\n").slice(0, 12)
}
`

const clean = `export function librarySheetLines(doc: PaperView): string[] {
  return (doc.preview ?? []).slice(0, 12)
}
`

test("a library card that reads lines from the listed body fires", () => {
  assert.deepEqual(detect(mistake, FILE), [message])
  assert.deepEqual(
    detect(
      mistake
        .replace("const paper = doc.paper\n  if (!paper) return []\n", "")
        .replace("paperPlainText(paper)", "paperPlainText(doc.paper)"),
      FILE
    ),
    [message]
  )
})

test("a library card that reads the preview stays quiet", () => {
  assert.deepEqual(detect(clean, FILE), [])
  assert.deepEqual(detect(mistake, "apps/api/src/paper/store.ts"), [])
})

test("the card that listed blank sheets for every Paper fires, and the live card stays quiet", () => {
  const introduced = execFileSync("git", ["show", `0c2b400bb:${FILE}`], {
    encoding: "utf8",
  })
  assert.deepEqual(detect(introduced, FILE), [message])
  assert.deepEqual(
    detect(readFileSync(new URL(`../${FILE}`, import.meta.url), "utf8"), FILE),
    []
  )
})
