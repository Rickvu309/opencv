import { execFileSync } from "node:child_process"
import {
  consumers,
  detectLinkDecorations as detectDecorations,
} from "./lib/paper-rich-structure.mjs"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectDirectMarks as detect } from "./lib/paper-link-patterns.mjs"

test("Word link styling preserves direct marks instead of stripping their XML", () => {
  for (const mark of ["b", "i", "u", "strike"])
    assert.ok(
      detect(`properties.replace(/<w:${mark}\\b[^>]*\\/>/g, "")`).length > 0
    )
  assert.deepEqual(
    detect(String.raw`properties.replace(/<w:color\b[^>]*\/>/g, "")`),
    []
  )
  assert.deepEqual(detect("wordRun(text, properties, href, links)"), [])
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../apps/api/src/paper/native-output/rich-text.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})

const imported =
  'import { effectiveRunDecorations } from "@workspace/domain/internal/paper-presentation";'
const delegated = `${imported} const decorations = effectiveRunDecorations(marks, isLink, inherited)`

test("page, toolbar and Word delegate link decorations to the domain", () => {
  for (const path of consumers) {
    for (const mistake of [
      "const decorations = isLink ? { underline: true } : marks",
      `${delegated}; const value = { ...decorations, ...(isLink ? { underline: true } : {}) }`,
      `${delegated}; if (href) { value.color = paperLinkColor }`,
      `${delegated}; const xml = href ? '<w:u w:val="single"/>' : ''`,
      `${delegated}; const style = isLink && 'color:#1D4ED8'`,
    ])
      assert.ok(detectDecorations(mistake, path).length, `${path}: ${mistake}`)
    assert.deepEqual(detectDecorations(delegated, path), [], path)
    assert.deepEqual(readCurrent(path), [], path)
  }
})

function readCurrent(path) {
  return detectDecorations(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    path
  )
}

test("rejects both independent implementations at 7195fc72", () => {
  for (const path of consumers) {
    const before = execFileSync(
      "git",
      ["show", `7195fc723aa9061d12debf62aa1261924a791f54:${path}`],
      { encoding: "utf8" }
    )
    assert.ok(detectDecorations(before, path).length, path)
  }
})
