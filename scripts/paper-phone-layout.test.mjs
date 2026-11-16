import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-phone-layout.mjs"

test("Paper can shrink below the document's intrinsic width", () => {
  const mistake = `<section className="rich-paper-page flex min-h-0 flex-1 flex-col" />`
  const clean = `<section className="rich-paper-page flex min-h-0 min-w-0 flex-1 flex-col" />`
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    ["paper-page-keeps-document-minimum-width"]
  )
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(detect(`<section className="flex flex-col" />`), [])
  const file = "apps/web/src/features/paper/rich-page.tsx"
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  assert.deepEqual(detect(source, file), [])
  assert.equal(
    detect(source.replace("min-w-0 flex-1", "flex-1"), file).length,
    1
  )
})
