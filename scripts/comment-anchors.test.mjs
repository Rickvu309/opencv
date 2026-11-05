import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
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

test("the old paper test fires because QVE-208 is only in the CSS note at that commit", () => {
  const sha = "57b78291^"
  const old = git(["show", `${sha}:${PAPER}`])
  const css = git(["show", `${sha}:${CSS}`])
  const oldHits = detect(old, PAPER, ioFor({ [CSS]: css }))
  assert.ok(oldHits.length > 0, oldHits.join("\n"))
  assert.ok(
    oldHits.every((hit) => hit.includes("appears only in a comment")),
    oldHits.join("\n")
  )
  assert.ok(oldHits.some((hit) => hit.includes('indexOf("QVE-208")')))
  const now = readFileSync(path.join(root, PAPER), "utf8")
  assert.deepEqual(detect(now, PAPER), [])
})

test("a url() that contains a slash-star is not a CSS note", () => {
  const css = `.x{background:url(a/*b)} .QVE{}\n`
  assert.deepEqual(paperHits(`${readsPaper}paperCss.indexOf("QVE")\n`, css), [])
})

test("replace, replaceAll, concat and + before a search are skipped", () => {
  const css = `.a\n  b{}\n`
  assert.deepEqual(
    paperHits(
      `${readsPaper}paperCss.replace(/\\s+/g, " ").includes("a b")\n`,
      css
    ),
    []
  )
  assert.deepEqual(
    paperHits(
      `${readsPaper}paperCss.replaceAll("\\n", " ").includes("a b")\n`,
      css
    ),
    []
  )
  assert.deepEqual(
    paperHits(
      `${readsPaper}const all = paperCss + "extra"\nall.includes("extra")\n`,
      css
    ),
    []
  )
  assert.deepEqual(
    paperHits(`${readsPaper}paperCss.concat("extra").includes("extra")\n`, css),
    []
  )
})

test("match, split and slice are not anchor searches", () => {
  const sheet = "/* QVE-208 */\naxb{}\n"
  const source = `${readsPaper}paperCss.match("a.b")
paperCss.split("/*")
paperCss.slice(0, 2)
`
  assert.deepEqual(paperHits(source, sheet), [])
})

test("search still anchors on a note", () => {
  const hits = paperHits(
    `${readsPaper}paperCss.search("QVE-208")\n`,
    cssWithNote
  )
  assert.equal(hits.length, 1)
  assert.match(hits[0], /search\("QVE-208"\) appears only in a comment/)
})

test("a markdown note fires and the same text in the body stays quiet", () => {
  const testFile = "scripts/note-anchor.test.mjs"
  const page = "scripts/page.md"
  const source = `import { readFileSync } from "node:fs"
const text = readFileSync(new URL("./page.md", import.meta.url), "utf8")
`
  const markdown = `<!-- ONLYNOTE -->
visible anchor
`
  const files = { [page]: markdown }
  const note = detect(
    `${source}text.indexOf("ONLYNOTE")\n`,
    testFile,
    ioFor(files)
  )
  assert.equal(note.length, 1)
  assert.match(note[0], /appears only in a comment/)
  assert.deepEqual(
    detect(`${source}text.indexOf("visible anchor")\n`, testFile, ioFor(files)),
    []
  )
})

test("JSON has no notes: a real string stays quiet and a missing string fires", () => {
  const testFile = "scripts/data-anchor.test.mjs"
  const data = "scripts/data.json"
  const source = `import { readFileSync } from "node:fs"
const text = readFileSync(new URL("./data.json", import.meta.url), "utf8")
`
  const files = { [data]: `{ "id": "present" }\n` }
  assert.deepEqual(
    detect(`${source}text.indexOf("present")\n`, testFile, ioFor(files)),
    []
  )
  const missing = detect(
    `${source}text.indexOf("missing-token")\n`,
    testFile,
    ioFor(files)
  )
  assert.equal(missing.length, 1)
  assert.match(missing[0], /appears nowhere/)
})

test("a read through a helper fires on a note and stays quiet on code", () => {
  const source = `${readsPaper}function loadCss() {
  return readFileSync(path.join(process.cwd(), "src/styles/paper.css"), "utf8")
}
const loaded = loadCss()
loaded.indexOf("QVE-208")
loaded.indexOf(".cv-a4-fit {")
`
  const hits = paperHits(source, cssWithNote)
  assert.equal(hits.length, 1)
  assert.match(hits[0], /indexOf\("QVE-208"\) appears only in a comment/)
})

test("a template-literal needle fires on a note and stays quiet on code", () => {
  const source = `${readsPaper}paperCss.indexOf(\`QVE-208\`)
paperCss.indexOf(\`.cv-a4-fit {\`)
`
  const hits = paperHits(source, cssWithNote)
  assert.equal(hits.length, 1)
  assert.match(hits[0], /indexOf\("QVE-208"\) appears only in a comment/)
})

test("a CSS note inside a css template fires and the rule stays quiet", () => {
  const testFile = "apps/web/src/styles/snippet.test.ts"
  const snippet = "apps/web/src/styles/snippet.ts"
  const source = `import { readFileSync } from "node:fs"
const text = readFileSync(new URL("./snippet.ts", import.meta.url), "utf8")
text.indexOf("QVE-208")
text.indexOf(".cv-a4-fit {")
`
  const files = {
    [snippet]: "export const css = css`\n/* QVE-208 */\n.cv-a4-fit { }\n`\n",
  }
  const hits = detect(source, testFile, ioFor(files))
  assert.equal(hits.length, 1)
  assert.match(hits[0], /indexOf\("QVE-208"\) appears only in a comment/)
})

test("scoped tests do not anchor on a note or on text that is not in the file", () => {
  const files = git(["ls-files", "--cached", "--others", "--exclude-standard"])
    .split("\n")
    .filter(isScopedTest)
    .filter((file) => existsSync(path.join(root, file)))
  const hits = []
  for (const file of files) {
    const text = readFileSync(path.join(root, file), "utf8")
    hits.push(...detect(text, file))
  }
  assert.deepEqual(hits, [])
})
