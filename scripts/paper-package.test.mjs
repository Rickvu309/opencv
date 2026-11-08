import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package.mjs"

test("Word content excludes property tabs and bounds expansion before retaining chunks", () => {
  const mistake = `
    import { DOMParser } from "@xmldom/xmldom"
    function paragraphText(node, source) {
      if (isWord(node, "tab")) return "\\t"
      return node.children.map(child => paragraphText(child, source)).join("")
    }
    function inflate(entry) {
      const bytes = inflateRawSync(entry.compressed)
      if (bytes.length > limit) throw new Error("late")
      return bytes
    }
  `
  const clean = `
    function paragraphText(node, source) {
      if (["pPr", "rPr"].some(name => isWord(node, name))) return ""
      const inRun = node.parent && isWord(node.parent, "r")
      if (isWord(node, "t")) return inRun ? text(node) : ""
      if (isWord(node, "tab")) return inRun ? "\\t" : ""
      if (isWord(node, "br")) return inRun ? "\\n" : ""
      return node.children.map(child => paragraphText(child, source)).join("")
    }
    function inflate(entry) {
      const inflater = createInflateRaw()
      inflater.on("data", chunk => {
        size += chunk.length
        if (size > limit) {
          inflater.destroy(new Error("limit"))
          return
        }
        chunks.push(chunk)
      })
    }
  `
  assert.equal(detect(mistake).length, 7)
  assert.deepEqual(detect(clean), [])
  for (const name of ["targets", "zip", "xml", "witness"]) {
    const source = readFileSync(
      new URL(`../apps/api/src/paper/package-${name}.ts`, import.meta.url),
      "utf8"
    )
    assert.deepEqual(detect(source), [], name)
  }
})
