import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/coach-whole-document.mjs"

const mistake = `async function outline(owner, docId) {
  const page = await readWordPackage(owner, { docId })
  return page.regions.map(region => region.text).join("\\n")
}`
const clean = `async function outline(owner, docId) {
  let page = await readWordPackage(owner, { docId })
  const regions = [...page.regions]
  while (page.nextCursor) {
    page = await readWordPackage(owner, { docId, cursor: page.nextCursor })
    regions.push(...page.regions)
  }
  return regions.map(region => region.text).join("\\n")
}`

test("Coach context never mistakes one paged read for the whole document", () => {
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    ["single-page-document-context"]
  )
  assert.deepEqual(detect(clean), [])
  assert.equal(
    detect(
      mistake
        .replace("readWordPackage", "readWordParagraphs")
        .replace("page.regions", "page.paragraphs")
    ).length,
    1
  )
  assert.deepEqual(
    detect(
      clean
        .replaceAll("readWordPackage", "readWordParagraphs")
        .replaceAll("page.regions", "page.paragraphs")
    ),
    []
  )
  assert.equal(
    detect(
      mistake.replace("readWordPackage(owner,", 'registry.read("paper.read",')
    ).length,
    1
  )
  const historic = execFileSync(
    "git",
    ["show", "cda2c301:apps/api/src/paper/package-list.ts"],
    { encoding: "utf8" }
  )
  assert.equal(detect(historic).length, 1)
  for (const folder of ["paper", "coach"]) {
    const root = new URL(`../apps/api/src/${folder}/`, import.meta.url)
    for (const path of readdirSync(root, { recursive: true })) {
      if (!path.endsWith(".ts") || path.endsWith(".test.ts")) continue
      assert.deepEqual(
        detect(readFileSync(new URL(path, root), "utf8"), path),
        [],
        `${folder}/${path}`
      )
    }
  }
})
