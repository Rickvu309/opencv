import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { detect, isScopedTest, root } from "./lib/comment-anchors.mjs"

const PAPER = "apps/web/src/features/paper/paper-cv-document.test.tsx"
const CSS = "apps/web/src/styles/paper.css"

const git = (args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  })

function ioFor(files) {
  return {
    read: (rel) => files[rel] ?? null,
    exists: (rel) => rel === "." || Object.hasOwn(files, rel),
  }
}

const cssWithNote = `/* QVE-208 cafe density */
.paper-canvas-field { color: red; }
.cv-a4-fit {
  max-width: 100%;
}
`

const readsPaper = `import { readFileSync } from "node:fs"
import path from "node:path"
const paperCss = readFileSync(
  path.join(process.cwd(), "src/styles/paper.css"),
  "utf8"
)
`

function paperHits(source, css) {
  return detect(source, PAPER, ioFor({ [CSS]: css }))
}

test("a search for text that lives only in a CSS note fires", () => {
  const hits = paperHits(
    `${readsPaper}paperCss.indexOf("QVE-208")\n`,
    cssWithNote
  )
  assert.equal(hits.length, 1)
  assert.match(hits[0], /indexOf\("QVE-208"\) appears only in a comment/)
  assert.match(hits[0], /apps\/web\/src\/styles\/paper\.css/)
})

test("a selector anchor stays quiet, including when a note repeats it", () => {
  const source = `${readsPaper}paperCss.indexOf(".cv-a4-fit {")\n`
  assert.deepEqual(paperHits(source, cssWithNote), [])
  const repeated = `/* .cv-a4-fit { */\n.cv-a4-fit {\n  max-width: 100%;\n}\n`
  assert.deepEqual(paperHits(source, repeated), [])
})

test("a search for text that is not in the file fires", () => {
  const css = `.cv-a4-fit {\n  max-width: 100%;\n}\n`
  const hits = paperHits(`${readsPaper}paperCss.indexOf("QVE-208")\n`, css)
  assert.equal(hits.length, 1)
  assert.match(hits[0], /appears nowhere/)
})

test("an absence check stays quiet", () => {
  const source = `${readsPaper}expect(paperCss).not.toContain("QVE-208")\n`
  const css = `.cv-a4-fit {\n  max-width: 100%;\n}\n`
  assert.deepEqual(paperHits(source, css), [])
})

test("a line note in a source file fires and the code string stays quiet", () => {
  const testFile = "packages/domain/src/anchor.test.ts"
  const target = "packages/domain/src/anchor-target.ts"
  const source = `import { readFileSync } from "node:fs"
const text = readFileSync(new URL("./anchor-target.ts", import.meta.url), "utf8")
text.indexOf("QVE-208")
text.indexOf(".cv-a4-fit {")
`
  const targetText = `export const selector = ".cv-a4-fit {"\n// QVE-208\n`
  const hits = detect(source, testFile, ioFor({ [target]: targetText }))
  assert.equal(hits.length, 1)
  assert.match(hits[0], /indexOf\("QVE-208"\) appears only in a comment/)
})

test("the old paper test fires and the current paper test stays quiet", () => {
  const old = git(["show", `57b78291^:${PAPER}`])
  const now = readFileSync(path.join(root, PAPER), "utf8")
  const oldHits = detect(old, PAPER)
  const nowHits = detect(now, PAPER)
  assert.ok(
    oldHits.some((hit) => hit.includes('indexOf("QVE-208")')),
    oldHits.join("\n")
  )
  assert.deepEqual(nowHits, [])
})

test("scoped tests do not anchor on a note or on text that is not in the file", () => {
  const files = git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split("\n")
    .filter(isScopedTest)
  const hits = []
  for (const file of files) {
    const text = readFileSync(path.join(root, file), "utf8")
    hits.push(...detect(text, file))
  }
  assert.deepEqual(hits, [])
})
