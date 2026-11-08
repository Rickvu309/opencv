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
  for (const name of [
    "targets",
    "zip",
    "xml",
    "witness",
    "engine",
    "policy",
    "references",
  ]) {
    const path = `apps/api/src/paper/package-${name}.ts`
    const source = readFileSync(
      new URL(`../apps/api/src/paper/package-${name}.ts`, import.meta.url),
      "utf8"
    )
    assert.deepEqual(detect(source, path), [], name)
  }
})

test("review safety boundaries reject mistakes and accept clean fixtures", () => {
  const fixtures = [
    [
      "tracked row and cell",
      `function tableRevision() { return false }`,
      `function tableRevision() { return ["tcPr", "trPr", "ins", "del", "moveFrom", "moveTo", "cellIns", "cellDel", "cellMerge", "Change"] }`,
    ],
    [
      "indexed identity and reach",
      `function inspectTargetPolicy(node, part) { return descendants(part.root).filter(x => x === node) }`,
      `function inspectTargetPolicy(node, part, policy) { return [policy.paragraphIds.get(part), policy.identityValues.has(node.id), policy.rangeTargets.has(node)] }`,
    ],
    [
      "decoded controls",
      `function inspectRun(text) { return text }`,
      `function inspectRun(text) { if (/[\\t\\n\\r]/u.test(text)) return locked(text, "UNSUPPORTED_TEXT_CONTROL") }`,
    ],
    [
      "case-equivalent names",
      `function directory(name) { if (names.has(name)) refuse(); names.add(name) }`,
      `function directory(name) { if (names.has(name.toLowerCase())) refuse(); names.add(name.toLowerCase()) }`,
    ],
    [
      "case-variant XML",
      `class Package { static open(name) { return name.endsWith(".xml") } }`,
      `class Package { static open(name) { return /\\.(xml|rels)$/i.test(name) } }`,
    ],
    [
      "case-variant relationships",
      `function relationships(name) { return name.endsWith(".rels") }`,
      `function relationships(name) { return /\\.rels$/i.test(name) }`,
    ],
    [
      "paragraph context",
      `function inspectParagraph(text) { if (tableRevision()) return locked(text, "TRACKED_TABLE_REVISION"); return text }`,
      `function inspectParagraph(text) { if (Buffer.byteLength(text, "utf8") > PACKAGE_LIMITS.targetBytes) return locked(text, "PARAGRAPH_CONTEXT_TOO_LARGE"); if (tableRevision()) return locked(text, "TRACKED_TABLE_REVISION") }`,
    ],
  ]
  for (const [name, mistake, clean] of fixtures) {
    assert.ok(detect(mistake).length > 0, name)
    assert.deepEqual(detect(clean), [], name)
  }
  for (const scope of ["targets", "policy", "references", "zip", "engine"])
    assert.ok(
      detect("", `apps/api/src/paper/package-${scope}.ts`).length > 0,
      scope
    )
})
